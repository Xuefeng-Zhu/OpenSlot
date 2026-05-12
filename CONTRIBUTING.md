# Contributing

This repository is private. Keep contributions focused, tested, and clear about
the user flow or developer workflow they improve.

## Before You Start

1. Read [AGENTS.md](AGENTS.md) for repository-specific engineering guidance.
2. Check [docs/product-overview.md](docs/product-overview.md) for current
   implementation status.
3. Inspect the route, component, library module, and tests nearest your change.
4. Confirm whether the target surface is live, prototype, or mock-backed.

## Local Workflow

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Use the normal validation gate before opening a PR:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run verify` runs the same quality gate in one command.

## Pull Requests

- Keep PRs small enough to review comfortably.
- Describe the user-visible or developer-visible change.
- Include screenshots for UI changes when possible.
- Add or update tests when behavior changes.
- Update docs when commands, setup, architecture, environment variables, or
  user-visible behavior change.
- Do not commit secrets, `.env.local`, generated build output, or private
  credentials.

## Coding Guidelines

- Use TypeScript strict mode and `@/*` imports.
- Prefer existing local UI primitives from `src/components/ui/`.
- Validate API and form inputs with Zod schemas in `src/lib/validations/`.
- Keep service-role Supabase access in server-only modules and route handlers.
- Preserve booking integrity checks, idempotency behavior, RLS boundaries, and
  database exclusion constraints.
- Add new database changes as new migrations.

More detailed guidance lives in [docs/contributing.md](docs/contributing.md)
and [docs/development.md](docs/development.md).
