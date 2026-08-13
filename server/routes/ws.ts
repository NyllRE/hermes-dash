// WebSocket proxy: browser ⇄ Nuxt ⇄ Hermes gateway.
//
// The browser connects to `/ws` on this app (same origin). The upgrade is
// guarded with the same semantics as the REST proxy
// (server/utils/dashboardAuth.ts): the `hermesdash_token` cookie must
// match NUXT_DASHBOARD_TOKEN. The cookie verdict is stored on the peer
// context at upgrade time and enforced in `open`. The dev loopback bypass
// is an *additional* allowance for cookie-less peers only: they are still
// admitted if their remote address is loopback, checked in `open` (the
// upgrade hook has no peer yet, so the IP check can't run there).
//
// Once accepted, the server dials the Hermes chat WebSocket
// (`ws://<hermesApiUrl>/api/ws?token=<NUXT_HERMES_SESSION_TOKEN>`) and
// relays newline-delimited JSON-RPC frames verbatim in both directions.
// The Hermes session token is injected server-side only and never reaches
// the browser.
import { createHash, timingSafeEqual } from "node:crypto";

const TOKEN_COOKIE = "hermesdash_token";
const LOOPBACK_PEER_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const AUTH_CLOSE_CODE = 4401;

interface PeerState {
  upstream?: WebSocket;
  pending?: string[];
}

function tokensMatch(provided: string, expected: string): boolean {
  // Constant-time comparison over SHA-256 digests (same as dashboardAuth.ts).
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function loopbackBypassEnabled(): boolean {
  const setting = process.env.NUXT_DASHBOARD_ALLOW_LOOPBACK;
  return (
    setting === "true" ||
    (setting === undefined && process.env.NODE_ENV === "development")
  );
}

function getCookieValue(headers: Headers, name: string): string | null {
  const cookie = headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

function peerState(peer: { context: Record<string, unknown> }): PeerState {
  return peer.context as unknown as PeerState;
}

// Hermes session token for the upstream socket: env-configured, with the
// same HTML auto-discovery fallback as server/api/hermes/[...path].ts so
// local development works with zero config.
let discoveredToken: string | null = null;
let discovering: Promise<string | null> | null = null;

async function resolveUpstreamToken(): Promise<string | null> {
  if (process.env.NUXT_HERMES_SESSION_TOKEN) {
    return process.env.NUXT_HERMES_SESSION_TOKEN;
  }
  if (discoveredToken) return discoveredToken;
  if (!discovering) {
    discovering = (async () => {
      try {
        const { hermesApiUrl } = useRuntimeConfig().public;
        const html = await $fetch<string>(`${hermesApiUrl}/`, {
          headers: { Accept: "text/html" },
        });
        discoveredToken =
          html.match(/__HERMES_SESSION_TOKEN__\s*=\s*['"]([^'"]+)['"]/)?.[1] ??
          null;
      } catch {
        discoveredToken = null;
      }
      return discoveredToken;
    })();
  }
  return discovering;
}

export default defineWebSocketHandler({
  /**
   * Cookie guard, runs before the upgrade completes. The verdict is stored
   * on the peer context (`request.context` is the same object the peer
   * exposes in `open`) and enforced there, because the peer's remote
   * address is only known after the upgrade. A valid cookie always passes,
   * regardless of peer IP. Without a valid cookie the dev loopback bypass
   * still admits the upgrade; cookie-less non-loopback peers are closed in
   * `open` with 4401. Rejecting with a `Response` makes crossws answer 401
   * and never complete the upgrade.
   */
  upgrade(request) {
    const expected = process.env.NUXT_DASHBOARD_TOKEN ?? "";
    const provided = getCookieValue(request.headers, TOKEN_COOKIE);
    const authCookieValid = Boolean(
      expected && provided && tokensMatch(provided, expected),
    );
    request.context.authCookieValid = authCookieValid;

    if (authCookieValid) return;
    if (loopbackBypassEnabled()) return;
    throw new Response("Unauthorized", { status: 401 });
  },

  async open(peer) {
    // Cookie-authenticated peers pass regardless of peer IP (e.g. a phone
    // over Tailscale). Only cookie-less peers fall back to the dev loopback
    // allowance, restricted to direct loopback addresses.
    const authCookieValid = peer.context.authCookieValid === true;
    if (
      !authCookieValid &&
      (!loopbackBypassEnabled() ||
        !peer.remoteAddress ||
        !LOOPBACK_PEER_IPS.has(peer.remoteAddress))
    ) {
      peer.close(AUTH_CLOSE_CODE, "forbidden");
      return;
    }

    try {
      const token = await resolveUpstreamToken();
      const { hermesApiUrl } = useRuntimeConfig().public;
      const wsBase = hermesApiUrl.replace(/^http/, "ws");
      const upstream = new WebSocket(
        `${wsBase}/api/ws?${new URLSearchParams(token ? { token } : {})}`,
      );

      const state = peerState(peer);
      state.upstream = upstream;
      state.pending = [];

      let peerClosed = false;
      const closePeer = () => {
        if (peerClosed) return;
        peerClosed = true;
        try {
          peer.close();
        } catch {
          /* already closed */
        }
      };

      upstream.addEventListener("open", () => {
        // Flush anything the browser sent while the upstream socket dialed.
        while (state.pending && state.pending.length > 0) {
          upstream.send(state.pending.shift()!);
        }
      });
      upstream.addEventListener("message", (event) => {
        if (peerClosed) return;
        try {
          peer.send(String(event.data));
        } catch {
          // Peer went away mid-relay; the upstream close event cleans up.
          try {
            upstream.close();
          } catch {
            /* already closed */
          }
        }
      });
      upstream.addEventListener("close", closePeer);
      upstream.addEventListener("error", () => {
        // A close event always follows; nothing to do here.
      });
    } catch (err) {
      console.error("[ws] upstream dial failed:", err);
      peer.close(1011, "upstream unavailable");
    }
  },

  message(peer, message) {
    const state = peerState(peer);
    const upstream = state.upstream;
    if (!upstream) return;
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(message.text());
    } else if (upstream.readyState === WebSocket.CONNECTING) {
      // Frame arrived before the upstream socket opened — buffer it.
      if (!state.pending) state.pending = [];
      state.pending.push(message.text());
    }
  },

  close(peer) {
    const upstream = peerState(peer).upstream;
    if (
      upstream &&
      (upstream.readyState === WebSocket.OPEN ||
        upstream.readyState === WebSocket.CONNECTING)
    ) {
      try {
        upstream.close();
      } catch {
        /* already closed */
      }
    }
  },

  error(peer) {
    // Peer-side error; tear the upstream down so no socket leaks.
    const upstream = peerState(peer).upstream;
    if (upstream) {
      try {
        upstream.close();
      } catch {
        /* already closed */
      }
    }
  },
});
