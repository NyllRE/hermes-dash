# AGENTS.md — Hermes Dash

## Identity
Nuxt SPA dashboard that surfaces live Hermes agent sessions (gateway :8080) next to an AI SDK chat UI. The "Hermes Aroma" interface. Core value: watch agent sessions live without switching apps.

## Stack
- Nuxt 4 · Nuxt UI 4 · Tailwind 4 · TypeScript · pnpm
- Package manager: @antfu/ni (ni/nr/nun)

## Commands
- `nr dev` — dev server (DON'T if already running; ask user)
- `nr build` — production build
- `nr lint` — oxlint (`nr lint:fix` to auto-fix)
- `nr typecheck` — type checking
- `nr db:migrate` — sqlite migrations

## Agent Rules
@../.shared/AGENTS.base.md

## File Index
| File | Purpose |
|------|---------|
| `.agents/CONTEXT.md` | Project state, architecture, known issues — READ |
| `.agents/TASKS.md` | Active task queue |
| `.agents/memory/current_context.md` | Live session state — READ FIRST |
| `app/composables/useHermes*.ts` | Hermes API composables (proxy, polling, SSE send) |
| `app/pages/session/[id].vue` | Live session viewer (core) |
| `app/pages/debug.vue` | Gateway status table |
| `server/api/hermes/[...path].ts` | Nitro proxy → dashboard :8080 |
| `server/api/chat/send.post.ts` | SSE chat → :8642 (hardcoded) |

## Project-Specific Rules
- Hermes routes need no auth; nuxt-auth-utils only for AI SDK chat.
- Status derivation: `getSessionStatus` in `useHermes.ts` — ended = no icon + opacity-60, running/waiting animated (svg-spinners), stalled static (solar).
- Proxy token auto-discovery only works in loopback mode (127.0.0.1:8080).
- Main blocker: live session state (see TASKS.md).
