# Contributing

This repository is private. Keep changes small, tested, and clear.

## Before You Start

1. Read [AGENTS.md](../AGENTS.md).
2. Check current implementation status in [Product Overview](product-overview.md).
3. Inspect the files and tests near the target behavior.
4. Confirm whether the target area is live, mock-backed, or prototype-only.

## Change Guidelines

- Prefer focused PR-sized changes.
- Do not add dependencies unless the benefit is clear and documented.
- Do not move service-role logic into client code.
- Add or update tests for behavior changes.
- Update docs for setup, command, architecture, security, or user-flow changes.
- Do not document future features as implemented.
- Preserve existing naming and component patterns.

## Commit/PR Checklist

- Summary explains the user-visible or developer-visible change.
- Tests added or updated where needed.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test` passes.
- `npm run build` passes for route, environment, or production-sensitive changes.
- No secrets are committed.
- Docs are updated if the change affects contributors or users.

## Documentation Standards

- Be specific to this repository.
- Include exact file paths and commands.
- Mark unclear items as `TODO: verify`.
- Cross-link related docs when helpful.
- Keep docs concise enough to scan.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Agent Workflow](agent-workflow.md)
