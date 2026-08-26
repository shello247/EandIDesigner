# PLAN-002-TASK-004 — Panel SVG hydration

Start: 2026-08-26 13:48 America/Port_of_Spain
End: 2026-08-26 13:56
Duration: approximately8m
Status: complete

## Demonstrated cause and change

The production predecessor records three React418 page errors during the panel ownership create/save/reload workflow. A separate development diagnostic identifies `PlacementOverlay.tsx`'s panel hit-target `<title>` as the mismatch: JSX supplies three children (tag, space, title), but React SSR requires one title string and emits an empty title. Client rendering then supplies the tag and rebuilds the subtree.

The fix changes that title to one escaped template-string child, retaining the exact displayed wording and empty optional-title behavior. No panel geometry, ownership, symbol identity, model format, persistence, or SSR policy changes. No hydration suppression is used.

New server-render/hydrate tests cover enclosure and schematic-reference branches with `&` and angle brackets in the title. They assert server text, no recoverable errors, and preservation of the original SVG/title DOM nodes. Both fail on the predecessor's empty server title, then pass with the fix.

## Files

- `src/features/drawing_canvas/ui/canvas/PlacementOverlay.tsx`: one title expression.
- `src/features/drawing_canvas/tests/drawing-placement-hydration.test.ts`: SSR/hydration regression coverage.
- `scripts/drawing-performance-audit/run-command.mjs` and `runner.test.ts`: apply existing isolated host/port guards to diagnostic `next dev` too; negative tests for both server modes.
- Delivery task/state/report files.

## Retained evidence and limitations

Local evidence: `artifacts/drawing-performance/pass-1/`.

- `security-browser-01`: production predecessor22pass/5fail; assignment reaches its final unchanged pageErrors assertion and reports3React418 errors.
- `task004-diagnostic-dev-01`: compiler startup consumes27.6s;30s browser attempt times out. Server log identifies invalid multi-child title.
- `task004-diagnostic-dev-02`: warm diagnostic with explicit120s timeout captures React's exact title diff and stack. Later development-only JSON/HMR errors and the known closed-dialog loading overlay obstruct navigation; this is not a production acceptance or timing result. No product changes were made to bypass them.
- Diagnostic `next dev` appended its managed block to AGENTS.md. The server run correctly reports sourceDrift=true; only that generated block was removed afterwards. Browser batch fingerprints are stable after generation. These diagnostic batches are not mixed into production measurements. Owned dev parent/child stopped after PID/ancestry/path checks; no live3000 process touched.
- `task004-hydration-red`: both new unit cases fail because SSR title text is empty.
- `task004-hydration-green`: both new cases pass;16guarded-harness tests pass. Source fingerprint `603b6470eb5e349b80524b134ec19cf2d88582dd9fa55b043cdd1671e91e164b`.

## Verification commands

Use unique AUDIT_PHASE values, through `node scripts/drawing-performance-audit/run-command.mjs <label> ...`:

- `node node_modules/vitest/vitest.mjs run src/features/drawing_canvas/tests/drawing-placement-hydration.test.ts`
- `node node_modules/vitest/vitest.mjs run --config scripts/drawing-performance-audit/vitest.audit.config.ts`
- `cmd.exe /d /s /c "npm run typecheck"`
- `cmd.exe /d /s /c "npm run lint"`
- `cmd.exe /d /s /c "npm run build"`
- Production server `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100`.
- `node node_modules/@playwright/test/cli.js test --config scripts/drawing-performance-pass/playwright.config.ts drawing-panel-assignment.spec.ts`

Final production acceptance: `task004-production-01` passes the unchanged panel-assignment workflow (1test9.9s, one worker, no retry). The final empty pageErrors assertion now passes, versus3React418 errors in its predecessor. Layout ownership, terminal composition, detailed-sheet representation and save/reload assertions all remain unchanged. Build ID `V3_TA8ZqT1bWuMCL-NR-z`; source fingerprint matches the green unit batch. Full lint, full standalone types and production build pass. Owned3100 server stopped before the next source change; original-source verification passes.

Reviewed source checkpoint follows this report; exact remote SHA is recorded in the next task's recovery map. Last verified-stage tag remains `drawing-perf-pass-1-stage-0-20260826` -> `72888c4c554b92862a7ea31f93c606069b47fb0c`. This is a correctness repair, not a claimed CPU-speed improvement. Stage1 remains gated by the four other known stale-locator failures and CI work. Other dynamic SVG titles not exercised by this specific defect remain covered by the broader regression gate; no broad rendering refactor was introduced.
