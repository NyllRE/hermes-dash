# TASKS — Hermes Dash

## Active

- [x] **Fix live session state (main blocker)** — wiring fixes B1/B2/B3 landed and verified (lint + typecheck exit 0, orchestrator re-ran both):
  - B1: polling starts on mount + retries when session fetch fails (useHermesSessionPolling.ts)
  - B2: refresh handler now calls both refreshMessages + refreshSession ([id].vue)
  - B3: NuxtPage keyed by route.fullPath, no stale session id on param-only nav (app.vue)
  - Chat send wired: Editor emits submit → page handleSend → useHermesChatSend SSE (Editor.vue, [id].vue)
  - Audit: `01 Workspaces/Hermes Agent/Content/hermes-dash-code-audit-2026-08-12.md`

- [x] **Live chat box (the big one)** — landed and verified (lint + typecheck exit 0, orchestrator re-ran both):
  - `server/routes/ws.ts`: crossws WS proxy, cookie-guarded (assertDashboardAccess semantics), Hermes token injected server-side (env, discovery fallback), frame buffering while upstream dials, bidirectional relay, no leaks. nuxt.config.ts: nitro.experimental.websocket = true.
  - `app/composables/useHermesChatSocket.ts`: JSON-RPC client (create/resume/prompt.submit/interrupt/steer), backoff reconnect, outbox until gateway.ready, reactive connected/ready/running/streaming, delta accumulation, tool lifecycle, dedupe of local vs polled.
  - `Editor.vue`: real model selector from GET /api/hermes/model/options (provider groups, icons, session.info sync until user touches), contextual submit (steer when running, send when idle), Stop + Queue buttons while running, disabled when disconnected.
  - `[id].vue`: WS path replaces old SSE send (useHermesChatSend removed from page), polled-history merge with content-based dedupe, running falls back to polled isLive when socket down.
  - KEY ARCHITECTURE (from 2 investigations): only the tui_gateway JSON-RPC WS surface (8080 /api/ws) supports ALL of send/stop/queue/steer natively; HTTP 8642 has NO steer and session-chat turns are unstoppable. Steer = session.steer (mid-turn injection, no interrupt); idle = session.info running flag.

- [ ] **Live end-to-end test** — user restarts app (dev server with nitro websocket flag), login with 12345, open a session, verify: model selector lists real providers, send when idle, steer when agent running (submit while busy), Stop and Queue visible while running, deltas stream live into the view, polling backstop still updates.
- [ ] **Mobile pass (north star)** — layout, editor, sidebar on touch screens; the app's purpose is mobile Hermes Desktop alternative ("harness interface", T3 Code-style).

## Stashed

- [ ] **Subagent management UI (Hermes Aroma ideas)** — managing subagents properly in the UI. Parked until live state works.
- [ ] Make 8642 chat-send URL env-configurable.
- [ ] Shared state layer: composable factory with cache/dedupe (5 near-identical composables in useHermes.ts).
- [ ] Contract drift: fix types/hermes.ts vs vault API docs (16 missing status fields etc).
- [ ] Token discovery negative cache + rotation.
- [ ] Proxy query passthrough (repeated params comma-joined today).
- [ ] Sidebar double-fetch on navigation (30s interval + route watcher).
- [ ] Cleanup sweep: redundant deps, magic numbers, CI gaps (fmt:check, build step).
