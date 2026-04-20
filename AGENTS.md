# AGENTS

Operational runbook for coding agents in this repository.
Policy baseline lives in `.github/copilot-instructions.md`.

## Setup
- Required: Node.js and npm.
- Install dependencies: `npm install`
- Optional Playwright browser install: `npm run setup`
- Build generated scanner bundle before manual extension testing: `npm run build`

## Commands
- Build scanner bundle: `npm run build`
- Lint: `npm run lint`
- Format: `npm run format`
- Unit tests only: `npm run test:unit`
- Default test command (build + Jest): `npm test`
- E2E tests (build + Playwright): `npm run test:e2e`
- Instruction consistency check: `npm run check:ai-instructions`

## Repo Map
- `src/content.js`: content script bridge and scan/refine messaging.
- `src/service-worker.js`: Manifest V3 background/service worker logic.
- `src/background.js`: Firefox Manifest V2 fallback background script.
- `src/scanner-source.js`: scanner logic source for page-context execution.
- `src/scanner-core.js`: core scanner utilities used by the build step.
- `src/parse-path.js`: path parser embedded into generated scanner code.
- `src/popup/`: side panel UI (plain HTML/CSS/JS).
- `src/popup/popup.html`: side panel markup; also hosts the integrated Editor tab that embeds the RPG Maker data editor via iframe when the sidebar is wide and the page is detected as RPG Maker.
- `src/popup/save-editor.js`: standalone window for RPG Maker save file editing.
- `src/popup/rpgmaker-data-editor.js`: standalone window for live RPG Maker variables/switches/items (also embedded into the popup Editor tab).
- `scripts/build-scanner.mjs`: generates `src/popup/scanner-code.js`.
- `tests/unit/`: Jest unit tests.
- `tests/e2e/`: Playwright end-to-end tests.
- `manifest.chrome.json`: Chrome Manifest V3 source manifest.
- `manifest.json`: active local manifest (switched via `npm run use:chrome` / `npm run use:firefox`).
- `manifest.firefox.json`: Firefox-specific manifest variant.

## Do-Don't
- Do use existing npm scripts instead of ad-hoc command variants.
- Do keep popup code framework-free and aligned with current architecture.
- Do update tests when behavior changes.
- Do regenerate `src/popup/scanner-code.js` after scanner runtime changes.
- Don't hand-edit generated scanner bundle output.
- Don't add secrets, tokens, or private endpoints to tracked files.
- Don't change manifest permissions casually; keep changes minimal and explicit.

## Working Agreements
- Keep diffs focused on the requested task and avoid unrelated refactors.
- If docs or instructions drift from reality, update them in the same change.
- Keep instruction ownership clear:
  - `.github/copilot-instructions.md` = thin repo-wide policy baseline.
  - `AGENTS.md` = setup, commands, repo map, and execution guidance.

## Definition of Done
- `.github/copilot-instructions.md` and `AGENTS.md` exist and are consistent.
- `npm run check:ai-instructions` passes.
- For behavioral code changes, relevant tests are updated and executed.
- Generated files are up to date when source inputs changed.
- No unrelated files are modified.

## Boundaries
- No new production dependencies for instruction housekeeping.
- No broad refactors outside the requested scope.
- Keep CI changes minimal and only when needed.
