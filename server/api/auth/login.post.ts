// Password login for the dashboard.
//
// Verifies the submitted password against NUXT_DASHBOARD_TOKEN and, on match,
// sets the `hermesdash_token` cookie so subsequent API calls pass
// `assertDashboardAccess`. This route intentionally does NOT call
// assertDashboardAccess — it IS the login, so it must be reachable without a
// pre-existing cookie.
import { createHash, timingSafeEqual } from "node:crypto";
import { createError, readBody, setCookie } from "h3";
import type { H3Event } from "h3";

const TOKEN_COOKIE = "hermesdash_token";

function tokensMatch(provided: string, expected: string): boolean {
  // Same constant-time pattern as dashboardAuth.ts: compare SHA-256 digests so
  // timingSafeEqual always sees equal-length buffers.
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export default defineEventHandler(async (event: H3Event) => {
  const expectedToken = process.env.NUXT_DASHBOARD_TOKEN || "";

  const body = await readBody<{ password?: unknown }>(event).catch(() => ({} as { password?: unknown }));
  const password = typeof body?.password === "string" ? body.password : "";

  if (!expectedToken || !password || !tokensMatch(password, expectedToken)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  setCookie(event, TOKEN_COOKIE, password, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return { ok: true };
});
