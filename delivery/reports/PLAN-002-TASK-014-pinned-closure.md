# PLAN-002-TASK-014 — Complete pinned render dependency collection

Start: 2026-08-26 16:00 America/Port_of_Spain
End: 2026-08-26 16:10 America/Port_of_Spain
Duration: approximately 10 minutes
Status: verification complete; recovery checkpoint pending

## Invariants

Dependency collection must include every exact historical symbol version needed by placements, managed assets, component selections, structured terminal-strip members and generated modular-terminal templates. System-generated pseudo-version IDs must never reach database queries. Missing exact versions must retain current unresolved behavior; collection must not substitute a latest version.

Predecessor: `a4c2d8ced508b22bc69a7b212ffd6271d1b52138`, remotely verified and tagged as Stage3.

## Reproduction and finding

The predecessor collector read placement versions, asset component selections,
structured-member versions and member component selections. An adversarial,
schema-validated package proved two independent defects:

- it omitted managed-asset versions and both placement- and asset-owned modular
  terminal module-template versions;
- it forwarded eleven current system-generated placement versions to the
  database dependency query.

The fail-before result returned 7 records instead of the 10 persisted render
dependencies and retained all 11 generated pseudo-versions. Both tests failed
for the demonstrated reasons; the original output is retained in the task
transcript and was not replaced by a retry.

## Change

`collectDrawingSymbolVersionIds` now projects one deduplicated dependency set
through a shared inclusion function. It collects:

- ordinary placement versions and placement module templates;
- managed-asset versions, nested component selections and asset module
  templates;
- structured terminal-strip member versions and recursively nested member
  component selections.

The same inclusion path excludes the ten finite generated version IDs and the
asset-qualified structured-strip version family. Filtering is exact rather
than based on the word `generated`, so the adversarial persisted ID
`version_with_generated_in_its_name` remains included. The closure test imports
each generator's exported constants, causing any future identity drift to fail
visibly.

No lookup substitutes a latest version. A missing exact historical version is
retained by the collector, and the exact rendering resolver returns unresolved
when the supplied bundle contains only another version of the same symbol.

## Files changed

- `src/features/drawing_canvas/logic/services/drawing-symbol-version-references.ts`
- `src/features/drawing_canvas/tests/drawing-symbol-version-references.test.ts`
- `src/features/drawing_canvas/tests/drawing-generated-symbol-preparation.test.ts`
- Delivery OS task, plan, current-state and report records

No Prisma schema, saved drawing model, action contract, rendering output or
dependency changed.

## Verification

- Fail-before: 2/2 new closure tests failed as expected (7 rather than 10
  persisted references; 11 generated IDs incorrectly retained).
- Focused red/green: 2 files, 6 tests passed.
- Related unit regression: 7 files, 35 tests passed across component nesting,
  generated symbols, modular terminal groups and structured-strip copy/reuse.
- Full unit suite: 126 files and 735 tests passed.
- Full lint passed with zero warnings.
- Standalone application/test typecheck passed. Its first authoritative run
  caught test-only `Array.toSorted` use outside the configured library target;
  the test now sorts copies with the supported API and was rerun.
- Guarded synthetic SQLite bootstrap and production build passed. Candidate
  source fingerprint:
  `59d984ae0825029a67ac21dc2b76b7a54f51260521a02c08409415d806c38bfc`;
  build ID: `2Ne1JjWrjgYLutbT3t9_N`; source drift: false.
- Six serial production browser workflows passed with one worker and zero
  retries: panel component placement, PDF preview, modular terminal group,
  structured-member attributes, destination copy and shared strip reuse.
- Port 3100 was released. The live port 3000 process remains PID 31720 and was
  not restarted; the canonical database was not targeted.

## Comparison, risks and follow-up

This task is a correctness prerequisite rather than a claimed latency win.
Compared with the verified predecessor, the candidate includes three missing
dependency classes and removes eleven unnecessary pseudo-query candidates in
the controlled fixture. Task015 will use this complete closure to introduce the
batched exact render bundle and lightweight catalogue summaries. Until that
query split lands, the existing full catalogue behavior and cost remain.

The generated identity allowlist is intentionally explicit. Adding a new
system generator requires adding its constant to the closure test and its
version family to the collector. This fails closed in tests rather than
silently broadening a prefix rule.

## Recovery

Raw build and browser evidence remains under the ignored unique
`task014-build-v1` and `task014-browser-v1` artifact paths. Publication review,
source checkpoint SHA and exact remote verification: pending.
