// Proxy /api/hermes/* to the Hermes dashboard backend.
// Auto-discovers the _SESSION_TOKEN from the dashboard's SPA HTML so no
// env var ceremony is needed — works the same way the official dashboard
// SPA gets its token.
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

  // Discover token on first proxied request (lazy, cached after).
  const token = event.context.hermesToken ?? (await discoverToken(hermesApiUrl));
  event.context.hermesToken = token;

  const query = getQuery(event);
  const qs = Object.keys(query).length
    ? `?${new URLSearchParams(query as Record<string, string>)}`
    : "";

  return proxyRequest(event, `${target}${qs}`, {
    headers: token ? { "X-Hermes-Session-Token": token } : {},
  });
});
