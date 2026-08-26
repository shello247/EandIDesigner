# PLAN-002-TASK-002A — Dependency-security prerequisite

Start: 2026-08-26 13:21 America/Port_of_Spain
End: 2026-08-26 13:41 America/Port_of_Spain
Duration: approximately17m active (20m elapsed, including3m separate Task003)
Status: security prerequisite complete with existing browser failures retained; not a release

## Scope and baseline

User authorized narrowly scoped security repairs on 2026-08-26. Baseline recovery is b891b861786388f6908144435b8b7c70f5364534 (original source snapshot a8338272ea99e79f1909a6e8edd3cf8fa95bd01e). Work remains in codex/drawing-performance-pass-1; no live promotion, main merge, schema/provider or application engineering-data change.

Reproduced npm audit: 13 affected package entries, 10 high and 3 moderate; counts include dependency-chain parents, not 13 distinct exploits. Expired PostCSS/UUID exceptions also blocked the strict repository policy. This is dependency/advisory evidence, not a reproduced exploit of EI Designer.

## Repair and applicability

| Chain | Change | Applicability / compatibility |
| --- | --- | --- |
| Next / CSS / image processing | Next and matching eslint-config-next 16.2.11 -> 16.3.3 | Stays on framework major16. Next16.2.12 still pins affected PostCSS8.4.31/sharp0.34.5;16.3 provides fixed dependencies. Current16.3.3 security patch chosen rather than16.3.0. Locked PostCSS8.5.23 and sharp0.35.4. |
| Tailwind PostCSS | Tailwind and @tailwindcss/postcss4.3.1 ->4.3.3 | Patch pair; previous PostCSS8.5.15 exact dependency replaced by patched8.5.26. Controlled build path, no demonstrated attacker-controlled CSS. |
| Prisma configuration | Prisma/client remain6.19.3; parent-scoped deepmerge-ts8.0.0 override | Fixes recursive-graph exhaustion. Prisma passes deepmerge to its trusted local config loader with remote extension/env loading disabled. No application input path demonstrated. Version8 changes Map merging, but this app uses plain Prisma configuration; focused tests verify actual loader and record/array merge semantics. Remove override when upstream ships a compatible fixed dependency. |
| ExcelJS | ExcelJS remains4.4.0; parent-scoped uuid11.1.1 override | Actual dependency uses CommonJS v4, which is not the advisory's vulnerable method. Fixed11.1.1 retains CommonJS; later ESM-only versions deliberately not selected. Extended conditional-format XLSX round-trip exercises actual UUID serialization. |
| Tooling/transitive | brace-expansion1.1.18/2.1.4/5.0.9; js-yaml4.3.1; nanoid3.3.18; undici7.29.0 | Targeted within-major updates. npm8 retained the hoisted brace-expansion5.0.7 after update, so minimatch10.2.5 has an explicit5.0.9 patch override within its accepted range. No direct application dependency added. |

Primary evidence: npm registry package metadata and full audit output; [Deepmerge8 release and documented compatibility changes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0), [UUID advisory and fixed CommonJS-compatible version](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq), [Next16.2.12 release](https://github.com/vercel/next.js/releases/tag/v16.2.12), [Next16.3.3 security release](https://github.com/vercel/next.js/releases/tag/v16.3.3). Upstream security/release metadata verified on2026-08-26; npm findings alone are not the complete security posture.

Removed the now-obsolete PostCSS/UUID exceptions only after raw lockfile audit returned zero findings. Production allowlist is empty. All expiration, stale-entry, severity and dependency-chain tests remain as historical injected fixtures; new tests require an empty live allowlist and rejection of the formerly allowed chains. Audit severity threshold and error behavior unchanged.

## Verification and evidence

Raw evidence: artifacts/drawing-performance/pass-1/baseline/security-*.{log,json}, ignored. Each guarded completed check records command, exact source fingerprint, timestamps and source drift. Node24.11.1, installed npm shim8.19.2, Windows; no new dependency on a package manager.

- Pre-update integration tests:3 passed (Prisma config loading, plain merge, ExcelJS extended-format workbook).
- Candidate npm ci:580 installed packages, generated Prisma6.19.3 successfully; zero vulnerabilities; source drift=false.
- Strict dependency policy:0 accepted exceptions,0 below-threshold findings,0 blockers.
- Candidate focused security/compatibility:17 tests passed in2 files; source drift=false.
- Full unit:704 tests passed across116 files. Full lint passed. Standalone types:39 existing diagnostics, exact message/header comparison with the frozen investigation gives39 vs39,0 differences.
- First Next16.3.3 production build compiles, then exposes TypeScript6's existing deprecated baseUrl configuration. Removed redundant baseUrl rather than suppressing warnings; all @/ aliases already have explicit relative paths. No bare src/scripts/tests-root imports were found. Build v2 accidentally retried unchanged config after an atomic patch rejection; retained as a failed attempt. Build v3 with baseUrl removed catches the same39 existing test diagnostics instead of silently filtering test errors as before. Bring forward already-approved Task003 in a separate commit, then return to full production/browser verification. No new scope or assertion waiver.

Preserved failed attempts: direct npm.cmd spawn raises Windows EINVAL; direct system npm-cli.js fails with Class extends undefined; installed npm shim via cmd.exe succeeds. Initial exact ExcelJS override selector conflicted with its direct caret spec (EOVERRIDE); corrected parent selector to the declared spec. First candidate retained vulnerable brace-expansion5; scoped patch override resolves it. No forced update, blanket audit fix, exception extension, or ignored assertion was used.

## Files

package.json, package-lock.json, tsconfig.json (redundant baseUrl removal); scripts/dependency-audit-policy.ts; scripts/tests/dependency-audit-policy.test.ts; scripts/tests/dependency-compatibility.test.ts; scripts/tests/fixtures/security/prisma.config.ts; PLAN-002 task/plan/report/state files.

## Remaining gates and recovery

Final comparison: original27-test production suite repeated with one worker/no retries:22 pass,5 fail,0 skipped/flaky. Exact failing test identity set is unchanged. Same3 React418 hydration errors in panel-assignment; same4 stale Sheet Loader/Asset Manager locators. No new browser failure detected. These are Stage1 Tasks004/005, not waived passes. Save/reload, connected schedules/continuations, routing/hit-testing, guides/arrangement, terminal attributes/reuse, and PDF preview among passing checks. Detailed raw results/traces: artifacts/drawing-performance/pass-1/security-browser-01/; buildId UqgJOCoOVHLH0sgxhWWgq. No performance conclusion from suite duration.

The owned3100 process was stopped after verifying its PID and command against security-server-start.json; shutdown exit4294967295 is intentional, not a workload failure. Original source matched at17:41:13Z (changed/removed empty); port3000 unchanged. No live database inspection or modifications. Security/test code checkpoints99f38c5 and9349e31 are exact-remote verified; this report completion is a source-recovery checkpoint, no stage tag.

Task002A security gate resolves the original13 findings with no exceptions. Stage0 clean recovery build/run and Stage1 fully green browser gates remain. Resume002 automatically; then004/005. The zero audit result is not a security certification or proof that all possible vulnerabilities are absent.

Task003 checkpoint9349e31ee06e91c2e9f9a15cb7cdd0e21b31f7ed pushed and remote verified. It fixes the39 baseline test types separately; standalone types,704 units, full lint and production build now pass. Candidate source fingerprint17ce56960202be2bdbc44b14851e48c9e9d6f862deca6c814454de976ad1c7a6 (the test-repair checkpoint only adds test/package-script changes). Security production-browser run uses the original27-test list, one worker/no retries, unique security-browser-01 output directory; pending final comparison.

Task002A remains incomplete until Task003 typing repair enables production/browser checks. Stage0 clean recovery build/runtime and Stage1 known test typing, hydration and locator repairs are not declared passed. No verified-stage tag. Latest verified remote recovery before this task:b891b861786388f6908144435b8b7c70f5364534. Security changes are a WIP checkpoint, not a verified release. Original source verification at17:30:12Z matches with no changes/deletions; live listener remains127.0.0.1:3000 PID31720. No3100 listener started.
