# CONTEXT — Hermes Dash

## Identity
Nuxt SPA dashboard that surfaces live Hermes agent sessions (gateway at :8080) alongside an AI SDK chat UI. The "Hermes Aroma" interface project — the live session view is the core.

## Stack
- Nuxt 4.4 · Nuxt UI 4.9 · Tailwind 4 · pnpm (use `nr`/`ni`)
- `ssr: false`, modules: @nuxt/ui, @comark/nuxt, @nuxthub/core (sqlite), nuxt-auth-utils, nuxt-csurf, nuxt-spyglass
- h3 pinned 1.15.11 (nuxt-csurf compat)

## Commands
- `nr dev` / `nr build` / `nr preview`
- `nr lint` (oxlint) · `nr typecheck` · `nr db:migrate`

## Architecture
- Browser SPA → Nitro proxy `server/api/hermes/[...path].ts` → dashboard :8080 (token auto-discovered from SPA HTML, `X-Hermes-Session-Token`)
- Chat send: `server/api/chat/send.post.ts` → hardcoded `127.0.0.1:8642` OpenAI-compatible API server (SSE)
- Routes: `/` landing, `/chat/[id]` AI SDK chat, `/session/[id]` Hermes viewer, `/debug` status table

## Session viewer (core)
- `useHermesSessionPolling`: 2s interval, refreshes session, diffs `message_count`, refreshes messages only on change; pauses on `ended_at`
- `useHermesChatSend`: SSE client, accumulates content/tool_calls deltas, AbortController cancel
- Custom render: SessionMessageContent (reasoning + tool calls + markdown), SessionToolCallDisplay, ChatComark

## Known Issues
- **LIVE STATE (main blocker):** text doesn't stream visibly, new session activity doesn't appear until session switch. Polling may not be firing, or message_count never changes mid-stream.
- Proxy token discovery only works in loopback mode (127.0.0.1).
- 8642 URL hardcoded in send.post.ts.

## Decisions
- Hermes routes need no login; nuxt-auth-utils only for AI SDK chat.
- Status badges: ended = no icon + opacity-60; running/waiting animated icons (svg-spinners), stalled static (solar).
