Continue building this app according to the design document in docs/system-design.md.

Primary goal:
Implement the next highest-priority parts of the app described in the design doc, preserving the existing architecture and coding style.

Before coding:
1. Read the design doc fully.
2. Read README, package/config files, existing tests, and any AGENTS.md or repository guidance.
3. Inspect the current app structure and identify what has already been implemented.
4. Create a brief implementation plan that breaks the remaining work into small, commit-sized milestones.

Implementation rules:
- Work in small vertical slices.
- Prefer completing usable features end-to-end over broad partial rewrites.
- Follow the design doc as the source of truth.
- If the design doc is ambiguous, make a reasonable choice, document the assumption, and keep moving.
- Do not introduce unrelated refactors.
- Do not change public APIs, database schema, routing, or major dependencies unless needed by the design doc.
- Keep the UI consistent with the existing design system and component patterns.
- Add or update tests for meaningful behavior changes.
- Update documentation when setup, configuration, commands, or behavior changes.
- Do not commit secrets, generated build outputs, local env files, lockfile churn unrelated to dependency changes, or binary artifacts.

Commit workflow:
- Make commits throughout the process.
- Commit after each coherent milestone, such as:
  - project setup/config changes
  - data model or API changes
  - one complete UI screen/flow
  - one backend feature
  - test coverage for a completed feature
  - documentation updates
- Before each commit:
  1. Run relevant formatting, linting, type-checking, and tests.
  2. Review `git diff`.
  3. Confirm no secrets, debug-only code, or unrelated changes are included.
- Use clear conventional commit messages, for example:
  - `feat: add onboarding flow`
  - `feat(api): implement project creation endpoint`
  - `fix: handle empty design state`
  - `test: cover authentication guard`
  - `docs: update local setup instructions`
- Do not squash commits. Preserve the step-by-step development history.

Validation:
- Run the strongest practical validation available in this repo, such as:
  - install/build command
  - unit tests
  - integration tests
  - lint
  - type check
  - app smoke test
- If a command fails because of missing external services or environment variables, document the failure and the exact command/output summary.

Final response:
When finished, provide:
1. Summary of what was implemented.
2. List of commits made with commit hashes and messages.
3. Tests/checks run and their results.
4. Any assumptions made from the design doc.
5. Any remaining TODOs or recommended next steps.

Start now by reading the design doc and repository guidance, then proceed with implementation and commits.