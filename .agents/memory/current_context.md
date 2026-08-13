# Current Context — Hermes Dash

_Updated: 2026-08-12_

## What happened this session

Project: **Hermes Dash = "harness interface"** (T3 Code-style client for the Hermes agent harness). North star: fully featured mobile alternative to Hermes Desktop, chat with the agent on the phone. Session viewer is NOT read-only, it's the product.

1. Registered desktop Project `hermes-dash` (p_29c8b6de), bootstrapped `.agents/` context tree, AGENTS.md + CLAUDE.md symlink.
2. 4 parallel audit workers → full code/data audit, saved to vault: `01 Workspaces/Hermes Agent/Content/hermes-dash-code-audit-2026-08-12.md`. Verdict: clean foundation (lint/typecheck 0 errors, strict TS), 4 blockers in live-state wiring, all verified by orchestrator against source.
3. 2 parallel repair workers → B1/B2/B3 + chat send wiring. All diffs inspected by orchestrator, lint + typecheck re-run and exit 0.
4. SOUL.md delegation contract strengthened: manager/worker model permanent, judgment-based (delegate when surface area, direct for trivial edits).
5. Auth work: password login flow (login.post.ts, login.vue, status.get.ts, auth.global.ts middleware, hermesFetch 401 redirect), NUXT_DASHBOARD_TOKEN=12345 TEST in .env + NUXT_HERMES_SESSION_TOKEN from live dashboard (backup /tmp/hermes-dash-env-backup). Tailscale trust idea REJECTED. Black-flash fix: pending now gates only initial load.
6. **Streaming map (verified, source-cited)**: best live source is dashboard `/api/ws` (8080) — JSON-RPC 2.0, per-session passive via `session.resume`, per-token `message.delta`/`reasoning.delta`/`thinking.delta` ~30fps, tool lifecycle, in-flight text on resume; same channel Hermes Desktop uses; auth `?token=` loopback / `?ticket=` gated. CAVEAT: dashboard (8080) and gateway (8642) are SEPARATE processes — `/api/ws` only streams turns executing in the dashboard process; gateway-driven turns (Telegram/CLI/8642) have NO passive stream anywhere, 2s polling stays as backstop. Self-originated sends: `POST /api/sessions/{id}/chat/stream` (8642, Bearer API_SERVER_KEY) streams `assistant.delta` per token. `/v1/runs/{id}/events` is run-scoped one-shot SSE (drops thinking). Dashboard has ZERO SSE. Vault `WebSocket Endpoints.md` was stale — REWRITTEN with verified JSON-RPC protocol.
7. Chat-control surface investigation (models list, send/stop/queue/steer endpoints) — dispatched, report pending. This feeds the final chat box implementation.

## Current state

- **Fixed**: polling deadlock (starts on mount + retries, sessionError surfaced), refresh button calls both refreshes, NuxtPage keyed by route.fullPath (no stale session), editor wired to SSE send (defineModel + submit emit → handleSend).
- **Auth (new)**: password login flow landed. POST /api/auth/login (constant-time vs NUXT_DASHBOARD_TOKEN, sets httpOnly lax hermesdash_token cookie), /login page, GET /api/auth/status probe, global route middleware (app/middleware/auth.global.ts) that gates ALL navigation to /login when unauthenticated (cached verdict, fail-open on probe errors, re-probes when leaving /login so login succeeds), hermesFetch 401 → markUnauthorized() + navigateTo('/login'). Tailscale trust idea REJECTED by user, removed from guard + .env.example. Proxy now uses NUXT_HERMES_SESSION_TOKEN from env (discovery as dev fallback). .env has NUXT_DASHBOARD_TOKEN=12345 (TEST VALUE, user's choice for testing) + NUXT_HERMES_SESSION_TOKEN (from live dashboard). Backup: /tmp/hermes-dash-env-backup.
- **Working tree**: 8 modified + 5 new files, nothing committed. Branch master.
- **Not done**: live end-to-end verification (needs app restart with new code), dedupe/merge race, mobile pass.

## Next steps (in order)

1. **Live verification** — user runs dev server + gateway (or approves me checking ports), watch a real session stream, send a test message through the new editor. IMPORTANT: test messages are marked as verification probes; the orchestrator is the agent itself so its own echo must never be mistaken for user input.
2. **Dedupe** — polled vs local SSE duplicate rendering ([id].vue:17-21).
3. **Mobile pass** — layout/editor/sidebar on touch; the whole point of the app.

## Blockers / notes

- Dashboard must run loopback (127.0.0.1:8080) for token auto-discovery.
- Don't commit; ask before starting dev server.
- Worker 1 violated the "don't run lint/build" instruction (ran them anyway) — outcome benign, orchestrator re-verified all checks independently.
