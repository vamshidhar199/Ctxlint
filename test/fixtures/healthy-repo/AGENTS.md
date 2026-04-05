# AGENTS.md

## Build & test
- Install: `pnpm install`
- Dev: `pnpm dev`
- Test: `pnpm test` (vitest)
- Lint: `pnpm lint --fix`
- Type check: `pnpm typecheck`
- DB migrate: `pnpm db:migrate` (Prisma)

## Non-obvious patterns
- API routes use edge runtime, not Node. Do not import Node-only modules in app/api/.
- Auth uses a custom JWT middleware in lib/auth.ts — not next-auth.
- All env vars are validated at startup via lib/env.ts. Add new vars there first.

## Constraints
- Node >= 20 (.nvmrc)
- pnpm only (corepack enforced)
