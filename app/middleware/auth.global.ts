// Global auth gate.
//
// The dashboard cookie is httpOnly, so the client cannot read it to determine
// auth state — instead we probe the server once per SPA session and cache the
// verdict here. `markUnauthorized()` is called by hermesFetch's 401 handler to
// invalidate the cache when a session dies mid-browsing, so the next
// navigation re-gates instead of trusting the stale verdict.
import { navigateTo } from "#app";

let authChecked = false;
let authOk = false;

/**
 * Invalidate the cached gate verdict. Called when any API request returns 401
 * while browsing, so the next navigation redirects to /login again.
 */
export function markUnauthorized(): void {
  authChecked = true;
  authOk = false;
}

async function probeAuth(): Promise<void> {
  try {
    const res = await fetch("/api/auth/status", { credentials: "include" });
    authOk = res.ok;
  } catch {
    // Fail open: a down/erroring backend must not lock the user out of the UI.
    authOk = true;
  }
  authChecked = true;
}

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) return;

  // /login is public — never gate or redirect it (this is what prevents loops).
  if (to.path === "/login") return;

  // Probe on first navigation, and again when leaving /login: a negative
  // verdict cached before login is stale once the login cookie lands, so
  // re-verifying here is what lets a successful login through.
  if (!authChecked || from.path === "/login") {
    await probeAuth();
  }

  if (!authOk) {
    return navigateTo("/login");
  }
});
