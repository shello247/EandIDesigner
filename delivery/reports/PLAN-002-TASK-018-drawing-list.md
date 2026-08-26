# PLAN-002-TASK-018 — Drawing list pagination report

Start: 2026-08-26 17:07 America/Port_of_Spain

End: 2026-08-26 17:27 America/Port_of_Spain

Duration: approximately 20 minutes

## Result

The Drawings page now uses validated, deterministic 25-row server pagination. It counts non-archived drawings separately, clamps the requested page to the real last page, reads `modelJson` only for that page, and returns summary-only records to the UI. Visible rows retain exact sheet counts through the existing parser. Ordering is `updatedAt` descending and ID ascending, so tied revisions are stable.

Invalid page inputs resolve to page 1. A page made empty by deleting its last item redirects to the new last page. The existing columns, creation, deletion, empty state, and drawing navigation remain. The separate BOM drawing-option query is unchanged. No schema, migration, persistent summary cache, or backfill was introduced.

## Verification

- Fail-first unit contract: 10/10 cases failed because the page parser and bounded query did not yet exist; all passed after implementation.
- Focused final gate: 18/18 pagination and CI-scope tests passed.
- Full unit gate: 129 files, 760 tests passed.
- Full lint and standalone application-plus-test type-check passed.
- Final guarded build passed with source fingerprint `e44ad37db7cdd439dda40bdcb3edb540aa20bad0c8637801b041ee35e58e6839`, build ID `U61_at_9WGtPfCIMgWTEK`, and no source drift.
- Dedicated production browser workflow passed against 10, 100, and 500 drawing fixtures. It verified 25-row boundaries, tie ordering, navigation, invalid input, exact sheet counts, and last-page deletion clamping.
- Complete local production drawing gate: 29/29 workflows passed in approximately two minutes, one worker, no retries.
- GitHub CI `33015096686` passed audit, lint, types, 760 units, isolated audit contracts, synthetic bootstrap, build, and all 29 production workflows for exact source SHA `b7eb5ca1e527ccdfaa81373d50a87bcac129c9ba`.

Retained failures: the first guarded build invocation used an incorrect relative npm CLI path and failed before compilation. The corrected guarded invocation passed. The first full unit run correctly failed its exact CI-scope count after the new production workflow was added; the expected scope was updated from 24 to 25 distinct spec files, and the full suite then passed without weakening any workflow assertion.

## Measurements

Five warmups and 30 measured list calls per scale on the same guarded SQLite environment:

| Packages | Predecessor median / p95 | Candidate median / p95 | Predecessor / candidate response | Candidate queries |
|---:|---:|---:|---:|---:|
| 10 | 31.71 / 45.48 ms | 32.06 / 44.66 ms | 1,241 / 1,305 bytes | 2 |
| 100 | 250.12 / 329.08 ms | 78.47 / 96.47 ms | 12,581 / 3,216 bytes | 2 |
| 500 | 1,352.99 / 1,879.40 ms | 77.37 / 90.73 ms | 63,781 / 3,267 bytes | 2 |

The candidate is effectively flat from 100 to 500 because both cases parse 25 documents. At 500 packages, median processing fell about 94% and response size about 95%. The small 10-package case is intentionally unchanged apart from the new count query. SQL time at 500 was 3 ms median and 4 ms p95.

SQLite uses `Drawing_updatedAt_idx` and a temporary B-tree for the ID tie-break term. A composite-index migration is deliberately deferred; measured candidate p95 remains below 100 ms at 500 packages without one.

## Recovery and risks

- Source checkpoint `b7eb5ca1e527ccdfaa81373d50a87bcac129c9ba` was publication-reviewed, pushed, and exact remote branch SHA verified.
- Annotated tag `drawing-perf-pass-1-stage-5-20260826` is remotely verified and peels to that exact checkpoint.
- Exact sheet counts still require parsing each of the at most 25 visible documents. One individually very large drawing can therefore still affect its page.
- Offset pagination is appropriate for this SQLite pass and the stated 500-package fixture. Cursor pagination and a composite index remain possible PostgreSQL-era work, not hidden scope here.
