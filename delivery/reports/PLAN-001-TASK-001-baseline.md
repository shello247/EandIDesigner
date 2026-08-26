# PLAN-001-TASK-001 — Baseline and architecture map

Status: complete with recorded limitations. Investigation only; not a claim that all tests/budgets pass.

Run: `20260826-baseline`. UTC command timestamps and durations are in the referenced `*-start.json` / `*-result.json` files. Work packages were interleaved; command durations are not exclusive task labor estimates. Local summaries use America/Port_of_Spain (UTC−04:00).

Captured 655 eligible dirty-source files at 2026-08-26T15:32:02.275Z (11:32 America/Port_of_Spain). Created the detached audit worktree with independent dependencies, Prisma client, build and guarded synthetic database. No canonical database read/copy or port-3000 restart.

The source fingerprint is `3d6ecb492fdeacf98887a56db7bdff8277c35c5b2794a44a228666213fd9c845`. Baseline production build passed in 69.213 s. Architecture paths and H01–H12 hypotheses are documented in [architecture map](PLAN-001-architecture-and-hypotheses.md).

Evidence: `source-manifest.json`, `build-baseline-result.json`, batch start/result records and final `source-verification.json` / `handoff-verification.json`.

Verification: `node scripts/drawing-performance-audit/snapshot.mjs --verify` in the original repository. Source matches are mandatory; Git commit alone is insufficient because the working source is dirty.

Limitations: the live WTP package was not inspected or modified; observations use synthetic drawings. Current workstation background activity was not controlled.

Raw evidence path: `artifacts/drawing-performance/20260826-baseline/`. Source/fixture definitions and hashes are shared with the main assessment and reproduction guide.

