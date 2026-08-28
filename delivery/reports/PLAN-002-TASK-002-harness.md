# PLAN-002-TASK-002 — Guarded harness and isolated baseline

Start: 2026-08-26 13:00 America/Port_of_Spain
End: paused 2026-08-26 13:05 America/Port_of_Spain
Duration: approximately 5 minutes active before pause
Status: complete after authorized security prerequisite and Task003; historical pause retained below

## Resumed completion — 2026-08-26 13:42-13:47

Task active duration approximately10m total (initial5m plus resumed5m), excludes002A/003. Clean detached recovery checkouta833827 remained pristine: independent install/Prisma generation, guarded synthetic bootstrap, original Next16.2.11 production build, and create/save/reload browser workflow all pass. Raw build/bootstrap: recovery-check artifacts/drawing-performance/recovery-check/baseline/; browser: recovery-smoke-02/. Source fingerprint60083064b7a83917387f36da083fd511122d57a57428e0d19a950352a8610442, no drift. The recovery's known vulnerabilities/types/browser failures remain documented; it is not a release.

Hardened runner records synchronous Windows launch exceptions as start/result/log files, waits for stdio close, refuses existing log-only labels, and hashes the actual external runner/config used with a recovery checkout. Four regression tests added: success/output draining, duplicate preservation, missing executable, synchronous Windows batch failure. Red run reproduces missing result; green harness14 tests passes. Standalone full types and scoped audit/pass lint pass. Source fingerprint88e6148ced57b18b6d9687867a9126271bfef6b3f517c853e2bbac4fa4386d1c.

Reusable Playwright config selects the guarded checkout's tests/device profile without importing a second runner. Rejects reused browser evidence only in parent process; workers legitimately re-import after output creation. First recovery smoke was blocked by that worker-reimport guard, retained as harness failure; corrected smoke passes without product/test changes in the original checkout. Browser output paths are unique; no original evidence overwritten.

Both owned3100 servers were stopped with PID/command ownership checks. Original source still matches at17:46:43Z; live3000 PID31720 untouched; no canonical database reads/writes. Stage0 source-recovery tag: drawing-perf-pass-1-stage-0-20260826, created on this reviewed task checkpoint and remote-verified before Task004. Previous remote checkpoint456ab343175252118fbf5eedfe56128474be8ab9. No stage1/release claim, main merge or live promotion.

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
