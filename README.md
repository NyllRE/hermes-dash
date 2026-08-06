# Hermes Dash

A local-first dashboard for observing and interacting with [Hermes Agent](https://hermes-agent.nousresearch.com) — the open-source AI agent framework by Nous Research. Built with Nuxt and Nuxt UI, it runs on your own machine and talks to a Hermes Agent that is also running on your machine.

**Hermes Dash is not a hosted Hermes service.** There is no cloud backend, no hosted model configuration, and nothing to deploy to make Hermes itself work. The app is a client-rendered frontend (`ssr: false`) plus a thin Nitro proxy that forwards requests to the local Hermes dashboard API.

> Status: early development. The Hermes session viewer is actively being built out; treat it as a working prototype, not a stable release.

## What it does

- **Session viewer** — the sidebar lists recent Hermes sessions (searchable, with running/waiting/stalled/ended status badges). Open any session at `/session/[id]` to read the full transcript: messages, reasoning, tool calls and their results, rendered as markdown. While a session is active the view polls the backend every two seconds so it stays live as the agent works.
- **Talk to a running agent** — from a session page you can send follow-up messages. Responses stream back from the local Hermes OpenAI-compatible endpoint (SSE).
- **Debug overview** — `/debug` shows gateway status (version, gateway state, connected platforms, active sessions/agents), the current model info, and a table of recent sessions.
- **Chat** — `/chat` and `/chat/[id]` retain the original AI SDK chat experience with chat history persisted in SQLite.

## Hermes dashboard vs. AI SDK chat

The repository contains two distinct experiences that share the same shell:

| Area | Routes | Backend |
| --- | --- | --- |
| **Hermes dashboard** (session viewer) | `/session/[id]`, `/debug` | Local Hermes Agent, via the `/api/hermes/*` Nitro proxy |
| **AI SDK chat** (retained template routes) | `/`, `/chat`, `/chat/[id]` | SQLite chat history + AI SDK chat endpoint |

The Hermes dashboard is the purpose of this project. The AI SDK chat routes, with their GitHub OAuth login, SQLite persistence and file uploads, are kept from the upstream Nuxt UI chat template this project started from.

## Prerequisites

- **Node.js 22** (what CI runs on)
- **pnpm** (the project is pinned to `pnpm@11.9.0` via `packageManager`)
- **A running local Hermes Agent** with its dashboard API reachable (default: `http://127.0.0.1:8080`)

## Configuration

The dashboard assumes a Hermes Agent is running locally. All Hermes API traffic goes through a Nitro proxy (`server/api/hermes/[...path].ts`).

- **`NUXT_PUBLIC_HERMES_API_URL`** — base URL of the Hermes dashboard backend. Default: `http://127.0.0.1:8080` (defined in `nuxt.config.ts` under `runtimeConfig.public.hermesApiUrl`). Override it in `.env` or the environment if your Hermes backend listens elsewhere.
- The proxy auto-discovers the backend's session token from the Hermes dashboard's SPA HTML (`__HERMES_SESSION_TOKEN__`) on first request, so no token environment variable is needed. Requests are forwarded with an `X-Hermes-Session-Token` header.
- Sending a message from a session page posts to `/api/chat/send`, which forwards to the Hermes OpenAI-compatible server at `http://127.0.0.1:8642/v1/chat/completions` with model `hermes-agent` (streaming and non-streaming supported). This endpoint address is currently hardcoded.

The dashboard API endpoints (`/api/hermes/*`, `/api/chat/send`, `/api/files/read`) are gated by `assertDashboardAccess` (see `server/utils/dashboardAuth.ts`):

- **`NUXT_DASHBOARD_TOKEN`** — the shared secret required for dashboard API access. The dashboard API reads it from the `hermesdash_token` cookie; a missing or mismatched cookie is rejected with 401. Requests fail closed without it: non-loopback requests are always rejected, and in production so are loopback requests (the bypass is off by default there). Generate one with `openssl rand -hex 32` — do not deploy with an empty token.
- **`NUXT_DASHBOARD_ALLOW_LOOPBACK`** — loopback bypass for requests from direct loopback peers (`127.0.0.1`, `::1`). Default: enabled in development (`pnpm dev`), **disabled in production**. Set it to `true` to explicitly allow the bypass in production (not recommended for anything reachable beyond your machine), or `false` to require the token even on localhost.
- **`NUXT_DASHBOARD_FILE_ROOT`** — root directory served by `/api/files/read`. Defaults to the project root (`process.cwd()`); only image files inside this directory (after symlink resolution) are served. If you want to render Hermes images stored outside the project root (e.g. the Hermes state/images directory), set this to a root that contains those locations so they fall inside the served boundary.

Note for reverse proxies and port forwarding: loopback detection uses the request's direct socket peer address and ignores `X-Forwarded-For` (spoofable), so a same-host reverse proxy or a port-forward appears to the app as a loopback peer. That bypass is enabled by default only in development. In production the loopback bypass is off by default, so the proxy must set the `hermesdash_token` cookie (or forward the token) or every request is rejected with 401. Do not assume a same-host proxy is automatically safe: production deployments require the token from every peer, loopback included, unless you explicitly set `NUXT_DASHBOARD_ALLOW_LOOPBACK=true`.

If the Hermes backend isn't running, the dashboard pages show connection errors, but the app itself still starts and the AI SDK chat routes keep working.

## Getting started

Start your local Hermes Agent first, then:

```bash
pnpm install      # install dependencies (also runs `nuxt prepare`)
pnpm db:migrate   # apply SQLite migrations (chat history)
pnpm dev          # start the dev server on http://localhost:3000
```

Production build and preview:

```bash
pnpm build
pnpm preview
```

Validation:

```bash
pnpm lint         # oxlint
pnpm typecheck    # nuxt typecheck
pnpm build        # production build
```

Other scripts: `pnpm lint:fix`, `pnpm fmt`, `pnpm fmt:check`, `pnpm db:generate` (regenerate Drizzle migrations from the schema).

## Routes

| Route | Purpose |
| --- | --- |
| `/` | New-chat landing page (AI SDK chat) |
| `/chat` | Chat list |
| `/chat/[id]` | AI SDK chat thread (SQLite history) |
| `/session/[id]` | Hermes session viewer — live polling while the session is active |
| `/debug` | Hermes gateway status, model info, recent sessions |

## Privacy & security

Hermes Dash is local-first: in the default setup the Nuxt server and the Hermes backend talk over the loopback interface, and the app does not proxy traffic through third-party services. The session token is only ever forwarded to the configured local Hermes backend.

A few honest caveats:

- This is a self-hosted web app, not a hardened product. The dashboard API is protected by a shared-token cookie (`hermesdash_token`, see Configuration); the loopback exemption that skips the token is enabled by default only during development, so a production deployment requires the token from every peer. Anyone who can reach the app and obtain that token can read your agent's sessions.
- The retained AI SDK chat routes keep the template's optional GitHub OAuth login (`NUXT_SESSION_PASSWORD`, `NUXT_OAUTH_GITHUB_CLIENT_ID`, `NUXT_OAUTH_GITHUB_CLIENT_SECRET`); the Hermes dashboard routes do not require login — remote access is gated by the dashboard token cookie instead.
- CSRF protection is enabled (`nuxt-csurf`) for POST/PUT/PATCH/DELETE, except for a dev-only spyglass ingest endpoint.
- If you expose the app beyond localhost, you are responsible for securing it (authentication, network access, HTTPS). The token cookie is sent over plain HTTP too, so serve the dashboard over HTTPS when accessing it remotely.

## Project structure

```
app/
  pages/                  # /, /chat, /chat/[id], /session/[id], /debug
  components/session/     # session viewer UI (header, message content, tool calls)
  composables/            # useHermes*, session polling, chat send (SSE)
  types/hermes.ts         # Hermes API types
  layouts/default.vue     # shared shell: saved chats + recent Hermes sessions sidebar
server/
  api/hermes/[...path].ts # proxy to the Hermes dashboard backend
  api/chat/send.post.ts   # proxy to the Hermes OpenAI-compatible endpoint
  api/files/read.get.ts   # image file serving (bound to NUXT_DASHBOARD_FILE_ROOT)
  api/chats/...           # retained AI SDK chat history API
  utils/dashboardAuth.ts  # access control shared by the dashboard API routes
  db/                     # SQLite schema + Drizzle migrations
nuxt.config.ts            # runtime config (incl. NUXT_PUBLIC_HERMES_API_URL default)
```

## License

MIT — see [LICENSE](./LICENSE).
