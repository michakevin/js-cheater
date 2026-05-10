# Copilot Instructions (Thin Baseline)

## Scope
These guardrails apply to the whole repository.
For setup and command details, see `AGENTS.md`.

## Stack and Package Manager
- Use plain JavaScript (ES modules) for extension code.
- Use `npm` with `package-lock.json` as the source of truth.
- Keep the popup free of external UI frameworks.

## Architecture Guardrails
- `manifest.json` is the unified Manifest V3 that loads in both Chrome and Firefox without any pre-step.
- Do not hand-edit generated `src/popup/scanner-code.js`; rebuild it.

## Code Quality
- Follow repo ESLint and Prettier configuration.
- Prefer small, testable functions and focused modules.
- Avoid `eval` and `Function` constructor.

## Change Rules
- If scanner runtime files change (`src/scanner-source.js`, `src/scanner-core.js`, `src/parse-path.js`), run the build script.
- If behavior changes, update or add Jest tests in `tests/unit`.
- Only change manifest permissions when required and explain why.

## Boundaries
- Do not commit secrets, tokens, or private URLs.
- Do not add dependencies unless task-required and justified.
