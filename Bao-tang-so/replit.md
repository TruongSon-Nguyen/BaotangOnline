# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Sign-up/login and administrator access use PostgreSQL accounts and expiring
  HttpOnly cookies containing HS256-signed JWTs; passwords are stored using
  scrypt hashes. New accounts receive administrator access by default, per the
  product requirement. Set `AUTH_JWT_SECRET` to a random secret of at least 32 bytes
  for stable sessions across API restarts (required in production). For local
  development, the API optionally loads it from the Git-ignored
  `.local/api.env` file in the workspace.
- Admin pages and APIs validate the same signed session cookie; role changes are
  available in the administrator account screen.
- Artifact uploads accept JPEG, PNG, and WebP images up to 10 MB and persist
  them under `.local/uploads` by default. Set `BAOTANG_UPLOAD_DIR` to a durable
  storage path when deploying outside local development.
- Optional env: `API_URL` — API server origin for the Vite `/api` development
  proxy (defaults to `http://127.0.0.1:5000`).
- Run `pnpm --filter @workspace/db run push` after adding/changing database
  schema before starting the API.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
