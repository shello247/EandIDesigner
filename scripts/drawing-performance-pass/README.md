# Controlled drawing verification

No live promotion, database copy, or performance budget change is implied by this gate.

Use the registered `drawing-performance-pass-1` worktree (or another explicitly registered audit/recovery worktree). Commands fail closed for other local roots. On GitHub Actions, the root must be the real `GITHUB_WORKSPACE` checkout of `shello247/EandIDesigner`, with numeric run ID/attempt. SQLite targets are generated below that checkout's `prisma/` directory and contain the run identity. Database URLs from the environment cannot override the runner's target. No canonical database is read or copied.

## Local production gate

Port3100 must be free. Do not run another benchmark/build/browser suite concurrently. Build and bootstrap first using the guarded runner; never use the shared development script for synthetic tests.

```powershell
$env:AUDIT_PHASE='unique-stage-batch'
node scripts/drawing-performance-audit/run-command.mjs bootstrap node node_modules/tsx/dist/cli.mjs scripts/bootstrap-sqlite.ts
node scripts/drawing-performance-audit/run-command.mjs build cmd.exe /d /s /c "npm run build"
npm run test:drawing
```

`test:drawing` supplies the guarded database/mocks, starts `next start` itself, refuses an existing3100listener, runs Chromium with one worker/zero retries, and closes its owned test server. It never touches3000. Output paths refuse reuse; choose another phase for every rerun. First failures/traces stay available. Browser outputs are correctness evidence, not authoritative performance timing samples.

The ordinary `npm run test:e2e` configuration is not weakened or changed. The new focused gate's explicit scope is in `drawing-gate-scope.ts`, reproducing the audit's24files/27workflows. The other seven existing drawing files are retained and outside this initial gate:

- `drawing-panel-sheet.spec.ts`, `drawing-panel-discovery.spec.ts`, `drawing-panel-connection-reference.spec.ts`: broader drawing coverage to assess in Stage7; not claimed passing by this gate.
- `drawing-panel-deliverables.spec.ts`, `drawing-panel-generic-release.spec.ts`, `drawing-panel-quality-review.spec.ts`, `drawing-panel-release.spec.ts`: historical deliverables/review/release interfaces, some deliberately removed/deferred. Preserve their assertions/history pending explicit scope review; do not restore removed UI for a green result.

Task007 adds a28th workflow within the same24files: no unopened Wire Catalog download/overlay, first-open loading, draft/focus preservation, handled validation error/retry and nested Escape. New maintained workflows should extend the scope with corresponding evidence. The gate is not exhaustive certification or a multi-user/cloud capacity test.

Every maintained spec imports `tests/e2e/drawing-test.ts`. Its automatic fixture fails on unhandled page errors from the main page and popups, and detaches listeners after the test. It retains the total error count and at most20messages, so an error storm cannot create an unbounded diagnostic array. Existing workflow assertions and the original explicit hydration assertion remain.

## CI

`.github/workflows/ci.yml` runs on main/PRs and the approved performance branch: install, dependency audit, Chromium install, lint, full application/test typecheck, complete units, isolated-harness contracts, synthetic bootstrap, production build, then drawing workflows. Work is serial. Timing budgets are not compared between shared Linux runners and the Windows benchmark machine.

Failure artifact upload is restricted to this run's synthetic measurement JSON/logs and browser failure traces under `artifacts/drawing-performance/ci/`. No environment files, databases, exports from users, dependencies or build outputs are uploaded. Fixtures and mocked integrations contain no user data or credentials. Do not broaden this artifact path to the checkout root.

The source fingerprint, test scope, build ID and result records establish what ran. Remote source checkpoints and verified-stage tags are tracked in `delivery/`; pushing a recovery checkpoint is not a release or authorization to merge.
