# PLAN-002-TASK-002 — Guarded harness and isolated baseline

Start: 2026-08-26 13:00 America/Port_of_Spain
End: paused 2026-08-26 13:05 America/Port_of_Spain
Duration: approximately 5 minutes active before pause
Status: blocked before stage completion

## Changes

Generalized active CPU/SQL/browser harness configuration to explicitly registered workspace-contained audit, implementation and recovery-check roots. Database target is absolute, rejects redirects/mismatches, and never resolves the live canonical database. Runner refuses duplicate evidence labels, captures full source hashes before/after, records spawn failures and rejects occupied/wrong server ports. Existing one-off investigation snapshot/instrumentation/postprocessing tools remain pinned to their original audit; they were not run against product source.

Added production correctness configuration (one worker, no retries, retained failure traces) and negative configuration tests. Existing fixture/projection parity tests retained.

Files: scripts/drawing-performance-audit/{run-config.mjs,run-config.d.mts,run-command.mjs,common.ts,audit.test.ts,playwright.audit.config.ts}; scripts/drawing-performance-pass/playwright.config.ts; delivery state/report files.

## Verification

- Independent npm ci + Prisma generation passed in implementation and clean detached recovery checkout of a833827.
- Guarded fixture/measurement suite: 10 tests passed.
- Scoped harness lint passed.
- Scoped harness TypeScript check passed; this does not replace the pending repository-wide type repair.
- Source drift checks remained false in completed batches; original source verification matches with changed=[] and removed=[].
- Port3000 is still PID31720; no port3100 listener was started.
- Clean-checkout production build/bootstrap/runtime and broader baseline tests remain pending because the existing dependency security gate failed. No stage0 verified tag is granted.
- Raw results: artifacts/drawing-performance/pass-1/baseline/; clean-recovery install evidence is in the recovery-check worktree's artifacts/drawing-performance/recovery-check/baseline/.

## Blocker and decision

The existing npm run audit:dependencies policy exits 1 on the unchanged dependency set. npm reports 13 vulnerabilities (10 high, 3 moderate). Two existing temporary policy exceptions expired on 2026-08-20; additional unallowlisted findings affect existing Prisma/tooling, Next/PostCSS/sharp and other transitive chains. These are policy/audit findings, not a reproduced application exploit.

Resolving this requires dependency-security remediation or an explicit risk-policy decision beyond the approved migration/dependency-constrained performance work. No dependency versions, lockfile, exceptions, schema or product code were changed. Do not extend expiration dates or run npm audit fix/--force to manufacture a pass.

Requested direction: authorize a narrowly scoped dependency-security remediation prerequisite, using the smallest safe updates and full regression checks. Until then, pause automatic progression. Preserve existing failures and the recovery checkpoint.

## Recovery

Verified initial recovery source: a8338272ea99e79f1909a6e8edd3cf8fa95bd01e on origin/codex/drawing-performance-pass-1. This report and harness changes will be pushed as a WIP recovery checkpoint, not a completed-stage release. No PR, merge or live promotion.
