# Hermes Dash

A local-first dashboard for observing and interacting with [Hermes Agent](https://hermes-agent.nousresearch.com) — the open-source AI agent framework by Nous Research. Built with Nuxt and Nuxt UI, it runs on your own machine and talks to a Hermes Agent that is also running on your machine.

**Hermes Dash is not a hosted Hermes service.** There is no cloud backend, no hosted model configuration, and nothing to deploy to make Hermes itself work. The app is a client-rendered frontend (`ssr: false`) plus a thin Nitro proxy that forwards requests to the local Hermes dashboard API.

> Status: early development. The Hermes session viewer is actively being built out; treat it as a working prototype, not a stable release.

## What it does

- **Session viewer** — the sidebar lists recent Hermes sessions (searchable, with running/waiting/stalled/ended status badges). Open any session at `/session/[id]` to read the full transcript: messages, reasoning, tool calls and their results, rendered as markdown. While a session is active the view polls the backend every two seconds so it stays live as the agent works.
- **Talk to a running agent** — from a session page you can send follow-up messages, steer an in-flight session, queue input, stop it, or switch the model/provider. Live deltas stream over a WebSocket (`/ws`) to the Hermes gateway (JSON-RPC), with polling as the history backstop.
- **Debug overview** — `/debug` shows gateway status (version, gateway state, connected platforms, active sessions/agents), the current model info, and a table of recent sessions.

The AI SDK chat experience from the upstream Nuxt UI chat template (`/chat`, `/chat/[id]`, SQLite chat history, file uploads) has been removed — this project is the Hermes session dashboard only.

## Prerequisites

- **Node.js 22** (what CI runs on)
- **pnpm** (the project is pinned to `pnpm@11.9.0` via `packageManager`)
- **A running local Hermes Agent** with its dashboard API reachable (default: `http://127.0.0.1:8080`)

## Configuration

The dashboard assumes a Hermes Agent is running locally. All Hermes API traffic goes through a Nitro proxy (`server/api/hermes/[...path].ts`).

- **`NUXT_PUBLIC_HERMES_API_URL`** — base URL of the Hermes dashboard backend. Default: `http://127.0.0.1:8080` (defined in `nuxt.config.ts` under `runtimeConfig.public.hermesApiUrl`). Override it in `.env` or the environment if your Hermes backend listens elsewhere.
- The proxy auto-discovers the backend's session token from the Hermes dashboard's SPA HTML (`__HERMES_SESSION_TOKEN__`) on first request, so no token environment variable is needed. Requests are forwarded with an `X-Hermes-Session-Token` header.
- Sending a message from a session page goes over the `/ws` WebSocket proxy, which dials the Hermes gateway's chat WebSocket (`/api/ws`) and relays JSON-RPC frames. The Hermes session token is injected server-side and never reaches the browser.

The dashboard API endpoints (`/api/hermes/*`, `/api/files/read`, `/api/auth/*`, `/ws`) are gated by `assertDashboardAccess` (see `server/utils/dashboardAuth.ts`):

- **`NUXT_DASHBOARD_TOKEN`** — the shared secret required for dashboard API access. The dashboard API reads it from the `hermesdash_token` cookie; a missing or mismatched cookie is rejected with 401. Requests fail closed without it: non-loopback requests are always rejected, and in production so are loopback requests (the bypass is off by default there). Generate one with `openssl rand -hex 32` — do not deploy with an empty token.
- **`NUXT_DASHBOARD_ALLOW_LOOPBACK`** — loopback bypass for requests from direct loopback peers (`127.0.0.1`, `::1`). Default: enabled in development (`pnpm dev`), **disabled in production**. Set it to `true` to explicitly allow the bypass in production (not recommended for anything reachable beyond your machine), or `false` to require the token even on localhost.
- **`NUXT_DASHBOARD_FILE_ROOT`** — root directory served by `/api/files/read`, used to render session images (e.g. terminal computer-vision screenshots) that the Hermes agent stores as `file://` paths. Defaults to the project root (`process.cwd()`); only regular files inside this directory (after symlink resolution) are served. If your Hermes images live outside the project root (e.g. the Hermes state/images directory), set this to a root that contains those locations.

Note for reverse proxies and port forwarding: loopback detection uses the request's direct socket peer address and ignores `X-Forwarded-For` (spoofable), so a same-host reverse proxy or a port-forward appears to the app as a loopback peer. That bypass is enabled by default only in development. In production the loopback bypass is off by default, so the proxy must set the `hermesdash_token` cookie (or forward the token) or every request is rejected with 401. Do not assume a same-host proxy is automatically safe: production deployments require the token from every peer, loopback included, unless you explicitly set `NUXT_DASHBOARD_ALLOW_LOOPBACK=true`.

If the Hermes backend isn't running, the dashboard pages show connection errors, but the app itself still starts and the login page still works.

## Getting started

Start your local Hermes Agent first, then:

```bash
pnpm install      # install dependencies (also runs `nuxt prepare`)
pnpm db:migrate   # apply SQLite migrations (GitHub OAuth users)
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
| `/` | Landing page — greeting + recent Hermes sessions |
| `/session/[id]` | Hermes session viewer — live polling while the session is active |
| `/debug` | Hermes gateway status, model info, recent sessions |
| `/login` | Dashboard login (password or GitHub OAuth) |

## Privacy & security

Hermes Dash is local-first: in the default setup the Nuxt server and the Hermes backend talk over the loopback interface, and the app does not proxy traffic through third-party services. The session token is only ever forwarded to the configured local Hermes backend.

A few honest caveats:

- This is a self-hosted web app, not a hardened product. The dashboard API is protected by a shared-token cookie (`hermesdash_token`, see Configuration); the loopback exemption that skips the token is enabled by default only during development, so a production deployment requires the token from every peer. Anyone who can reach the app and obtain that token can read your agent's sessions.
- Access control: the dashboard is gated by the `hermesdash_token` cookie (see Configuration). Login happens via `/login` — a password matching `NUXT_DASHBOARD_TOKEN` — or via the optional GitHub OAuth flow (`NUXT_SESSION_PASSWORD`, `NUXT_OAUTH_GITHUB_CLIENT_ID`, `NUXT_OAUTH_GITHUB_CLIENT_SECRET`), which also persists the GitHub user in SQLite.
- CSRF protection is enabled (`nuxt-csurf`) for POST/PUT/PATCH/DELETE, except for a dev-only spyglass ingest endpoint.
- If you expose the app beyond localhost, you are responsible for securing it (authentication, network access, HTTPS). The token cookie is sent over plain HTTP too, so serve the dashboard over HTTPS when accessing it remotely.

## Project structure

```
app/
  pages/                  # /, /session/[id], /debug, /login
  components/session/     # session viewer UI (header, message content, tool calls)
  components/chat/        # session editor, streaming indicator, markdown rendering
  composables/            # useHermes*, session polling, gateway WebSocket chat
  types/hermes.ts         # Hermes API types
  layouts/default.vue     # shared shell: recent Hermes sessions sidebar
server/
  api/hermes/[...path].ts # proxy to the Hermes dashboard backend
  api/files/read.get.ts   # session image serving (bound to NUXT_DASHBOARD_FILE_ROOT)
  api/auth/...            # dashboard login + auth status
  routes/ws.ts            # WebSocket proxy to the Hermes gateway chat
  routes/auth/github.get.ts # optional GitHub OAuth login
  utils/dashboardAuth.ts  # access control shared by the dashboard API routes
  db/                     # SQLite schema + Drizzle migrations (OAuth users)
nuxt.config.ts            # runtime config (incl. NUXT_PUBLIC_HERMES_API_URL default)
```

## License

MIT — see [LICENSE](./LICENSE).
