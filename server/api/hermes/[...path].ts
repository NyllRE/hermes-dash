// Proxy /api/hermes/* to the Hermes dashboard backend.
// The Hermes session token is read from NUXT_HERMES_SESSION_TOKEN (injected
// server-side only, never sent to the browser). When it is unset — e.g. local
// development — the token is auto-discovered from the dashboard's SPA HTML as
// a fallback (requires the dashboard to be reachable at the configured
// hermesApiUrl, typically the loopback bind).
import { assertDashboardAccess } from "../../utils/dashboardAuth";

let discoveredToken: string | null = null;
let discovering = false;
let discoveryPromise: Promise<string | null> | null = null;

async function discoverToken(baseUrl: string): Promise<string | null> {
  if (discoveredToken) return discoveredToken;
  if (discovering) return discoveryPromise;
  discovering = true;

  discoveryPromise = (async () => {
    try {
      const html = await $fetch<string>(`${baseUrl}/`, {
        headers: { Accept: "text/html" },
      });
      const m = html.match(/__HERMES_SESSION_TOKEN__\s*=\s*['"]([^'"]+)['"]/);
      discoveredToken = m?.[1] ?? null;
      if (discoveredToken) {
        console.log("[hermes-proxy] discovered session token");
      }
    } catch {
      console.warn("[hermes-proxy] failed to discover token, requests may 401");
    } finally {
      discovering = false;
    }
    return discoveredToken;
  })();

  return discoveryPromise;
}

export default defineEventHandler(async (event) => {
  // Auth gates token auto-discovery and the proxy itself.
  assertDashboardAccess(event);

  const { hermesApiUrl } = useRuntimeConfig(event).public;
  const path = getRouterParam(event, "path") || "";
  const target = `${hermesApiUrl}/api/${path}`;

  // Prefer the env-configured session token; fall back to HTML discovery only
  // when it is unset (dev convenience). The env token is never exposed to the
  // browser — it is sent to the Hermes backend as a header only.
  const envToken = process.env.NUXT_HERMES_SESSION_TOKEN;
  const token =
    envToken || event.context.hermesToken || (await discoverToken(hermesApiUrl));
  event.context.hermesToken = token;

  const query = getQuery(event);
  const qs = Object.keys(query).length
    ? `?${new URLSearchParams(query as Record<string, string>)}`
    : "";

  return proxyRequest(event, `${target}${qs}`, {
    headers: token ? { "X-Hermes-Session-Token": token } : {},
  });
});
