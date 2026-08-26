# PLAN-002-TASK-006 — Production drawing verification gate

Start: 2026-08-26 14:00 America/Port_of_Spain
End: 2026-08-26 14:23 America/Port_of_Spain
Duration: approx 23m
Status: done

## Change and scope

The CI workflow now includes the explicitly authorized performance branch and adds full application/test typecheck, installed Chromium, guarded synthetic bootstrap, and a production drawing browser gate. The original lint/unit/build/audit checks remain. The new browser gate uses one worker, no retries, no existing-server reuse, and retains first failures under unique run directories.

The audit configuration supports the exact GitHub checkout/repository plus numeric run ID/attempt; it creates a unique synthetic database URL inside that checkout and rejects mismatched/escaped roots or identities. Local registered-worktree protection remains. Existing public drawing APIs, model JSON, Prisma schema, and runtime behavior are unchanged.

`test:drawing` is the new reusable command, with an explicit24-file/27-workflow scope matching frozen investigation evidence. Seven other spec files remain in the repository and are explicitly listed in the tooling README; this gate does not claim they passed. Historical removed/deferred analysis/review/deliverables UI is not restored.

Failure uploads are limited to synthetic audit JSON/logs and failure traces, not environment files, SQLite databases, user documents, dependencies or builds. CI has only contents:read permissions. Timing thresholds are not compared across Windows and shared Linux hardware.

## Files

- `.github/workflows/ci.yml`, `package.json`.
- `scripts/drawing-performance-audit/run-config.{mjs,d.mts}`.
- `scripts/drawing-performance-pass/{drawing-gate-scope.ts,playwright.release.config.ts,README.md}`.
- `scripts/tests/drawing-ci-gate.test.ts`.
- `tests/e2e/drawing-test.ts` and import-only changes in the24maintained specs: bounded automatic unhandled-page-error assertion, including popups. No original workflow assertion is removed.
- Delivery task/report/state records.

## Evidence

Predecessor `b29ee8fc592efe09b8a61721a0858ecc42b21b37` remotely verified. Last verified-stage tag remains Stage0.

Local `artifacts/drawing-performance/pass-1/task006-contracts/`:8CI boundary tests,16audit-harness tests, full types/lint,714units across118files pass. Fingerprint `bea31a0fa9fdaafb30dac2edb090466a16e8c7161284bb87a03ee59fb6c0d6a2`. Full production build, new browser command and GitHub run results follow below. No speedup is claimed from these correctness-run durations.

Review caught Playwright's default webServer working directory being its config directory (`node_modules/playwright/lib/runner/index.js`); the managed server's cwd is explicitly set to the validated application root before browser execution.

## Reproduction

Tooling README contains guarded local bootstrap/build/browser commands. Full local sequence uses unique phase + run-command wrappers for CI-contract Vitest, audit-harness Vitest, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`, then `npm run test:drawing`. GitHub executes the same semantic checks on a clean checkout with independent dependencies and database.

Final local browser result, CI run URL/checkpoint and stage acceptance: pending. No merge or live editor restart is authorized.

Local managed gate: `task006-production-gate-01` passes27/27 in118.784s command wall time. Final stronger gate `task006-strict-browser-01` passes27/27 in171.757s, including automatic page/popup error assertions; no retry, no source drift. This is not a controlled performance comparison (the test harness changed). Final browser fingerprint `c3ec3a75fd370370531809ef57515c764b447ffe6ef53e6e4449df94182842cb`; application build ID `mH-0YXKpCcYOFUWsqFWqh`. Only test/config files changed after that production build; the clean-checkout CI build verifies the final combined snapshot.

Negative guard probe: local ignored `task006-error-guard-probe/probe.spec.ts` injects one unhandled error. Its test is deliberately marked expected-to-fail; JSON confirms actual failure comes from the automatic fixture's `Unhandled drawing page errors` assertion with the exact injected message. Thus a passing probe proves the guard rejects errors, not that the injected error was waived in an engineering workflow. The reporter's relative output resolves under its config folder, producing a nested artifact path; the first read used the wrong path, then the original report was verified in place without rerunning/replacing it. This probe and its raw files are not published.

Final static batch `task006-final-static`:8scope/CI-boundary tests and standalone types pass on final test-fixture source. Original655source fingerprints match at18:10:02Z; only live3000 PID31720 remains after managed server cleanup. Public checkpoint is awaiting clean-checkout CI confirmation; no Stage1 tag yet.

Final lint identified the Playwright fixture callback named `use` as React's special `use` hook inside a try/finally. Renamed only the callback parameter to `runTest`, preserving teardown and the error assertion; no lint rule disabled. The original failed lint record is retained and the final static batch is rerun separately.

`task006-final-static-v2`: full lint and full standalone typecheck pass. Final checkpoint source fingerprint `89699d25bf3b18efaee882f671c64a610353d14e6a9aececced10010fdd6c1f5`; only the callback parameter spelling differs from the already passing stricter browser run (and README wording). Commit is a locally verified CI recovery checkpoint, not a Stage1 tag until clean-checkout GitHub verification finishes.

Published checkpoint: `e6b4f77673dcd47697c4ad8509626f693c1d5ac2`, exact remote branch SHA verified. Publication review checks37files with zero detected findings; raw probe/evidence excluded. [Clean-checkout CI run](https://github.com/shello247/EandIDesigner/actions/runs/32998543073) targets this exact SHA. Install/dependency audit passed; remaining checks pending. Do not mark Stage1 complete from the local result alone.

First CI run failed in full units:713pass/1fail. `scripts/tests/development-runtime.test.ts` supplied a Windows drive path to native Linux `path.resolve` but expected Windows absolute-path semantics. The resolver correctly treats that input as relative on Linux. Mechanical test-only repair uses a native absolute fixture/explicit expected string on each OS; Windows backslash conversion remains covered on Windows. No runtime/database selector changes or skipped assertion. This is a platform fixture defect, not a newly discovered unrelated application runtime failure. Original CI failure artifacts remain available and are retained locally; full CI rerun required.

CI annotation: existing v4 checkout/setup-node/upload-artifact actions declare Node20 and the runner forces Node24. This warning did not fail the job; action-version modernization is not silently bundled into this fixture repair. Repository runtime remains Node24.

Fixture-only repair checkpoint `c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83` pushed and exact remote SHA verified. Local4development-runtime tests and focused lint pass (`task006-platform-fixture`). First CI artifacts are retained at `artifacts/drawing-performance/pass-1/ci-32998543073-failure/`. [Second CI run](https://github.com/shello247/EandIDesigner/actions/runs/32998854844) is in progress for the repaired SHA; no retry of the original failing commit or removal of its evidence.

## Final Stage 1 acceptance

Second CI completed successfully at 2026-08-26T18:21:04Z for exactly `c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83`: install, zero-finding dependency audit, explicit Chromium installation, full lint/types/714 units, isolated harness contracts, synthetic bootstrap, production build and all27drawing workflows passed. One worker, zero retries and automatic page/popup-error assertions remained enabled. The Windows-only batch-runner contract is intentionally platform-specific; no engineering workflow was skipped. The original failed CI run is retained separately above.

Stage1 recovery tag: `drawing-perf-pass-1-stage-1-20260826`, targeting the tested code commit. This verifies the maintained correctness gate, not performance budgets, all historical specifications, cloud readiness or live promotion. Existing Node20 action-runtime deprecation warning remains a documented non-fatal follow-up. Next: Task007 conditional Wire Catalog mounting. No database or live application changes.
