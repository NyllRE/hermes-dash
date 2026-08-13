// Auth probe endpoint.
//
// The dashboard's auth cookie is httpOnly, so the client cannot read it to
// determine whether it is authenticated — it must ask the server. The global
// route middleware (app/middleware/auth.global.ts) calls this once per SPA
// session and caches the verdict to gate navigation behind /login.
import { createError } from "h3";
import type { H3Event } from "h3";
import { assertDashboardAccess } from "../../utils/dashboardAuth";

export default defineEventHandler((event: H3Event) => {
  try {
    assertDashboardAccess(event);
    return { ok: true };
  } catch {
    throw createError({ statusCode: 401 });
  }
});
