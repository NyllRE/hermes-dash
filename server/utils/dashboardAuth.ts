// Dashboard access control for the protected API endpoints.
//
// Loopback bypass: requests whose direct peer address is a loopback address
// are allowed without a token only when NUXT_DASHBOARD_ALLOW_LOOPBACK is
// explicitly "true", or (the default) when it is unset AND the server runs in
// development. In production the bypass is disabled by default, so a same-host
// reverse proxy or port-forward — which appears as a loopback peer — still
// requires the token. NUXT_DASHBOARD_ALLOW_LOOPBACK=false always disables the
// bypass, in every environment. All other requests must present the
// `hermesdash_token` cookie matching NUXT_DASHBOARD_TOKEN. Fail closed: unset
// or mismatched credentials always result in a 401.
import { createHash, timingSafeEqual } from "node:crypto";
import { createError, getCookie, getRequestIP } from "h3";
import type { H3Event } from "h3";

const TOKEN_COOKIE = "hermesdash_token";

// Direct loopback peer addresses only. `getRequestIP` is called with
// `xForwardedFor: false` so spoofable forwarded headers are never trusted;
// behind a reverse proxy the peer is the proxy, not the client.
const LOOPBACK_PEER_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function tokensMatch(provided: string, expected: string): boolean {
  // Compare SHA-256 digests so timingSafeEqual always sees equal-length
  // buffers, keeping the comparison constant-time regardless of length.
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export function assertDashboardAccess(event: H3Event): void {
  const allowLoopbackSetting = process.env.NUXT_DASHBOARD_ALLOW_LOOPBACK;
  // "true" is an explicit opt-in that also applies in production; "false"
  // always denies the bypass. Unset defaults to a dev-only bypass so `pnpm dev`
  // works with zero config, while production deployments fail closed and
  // require NUXT_DASHBOARD_TOKEN even from loopback peers.
  const allowLoopback =
    allowLoopbackSetting === "true" ||
    (allowLoopbackSetting === undefined && process.env.NODE_ENV === "development");

  if (allowLoopback) {
    const ip = getRequestIP(event, { xForwardedFor: false });
    if (ip && LOOPBACK_PEER_IPS.has(ip)) {
      return;
    }
  }

  const expectedToken = process.env.NUXT_DASHBOARD_TOKEN || "";
  const providedToken = getCookie(event, TOKEN_COOKIE) || "";

  if (!expectedToken || !providedToken || !tokensMatch(providedToken, expectedToken)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
}
