# PLAN-002-TASK-019 — Compact save acknowledgment report

Start: 2026-08-26 17:27 America/Port_of_Spain

End: 2026-08-26 17:40 America/Port_of_Spain

Duration: approximately 13 minutes

## Result

The normal editor save action now returns only the database-persisted `{ id, updatedAt }` acknowledgment. An optimistic save uses Prisma's existing SQLite-supported `updateManyAndReturn` with the expected revision in the update predicate, so the acknowledgment is produced atomically by the guarded write. It does not fabricate a client timestamp and does not reread or parse the saved drawing document.

The no-expected-revision path uses a unique update with the same selected acknowledgment fields. A zero-row optimistic update still performs the existing latest-revision lookup and raises the same conflict error. Approval retains its full-detail review wrapper because that caller still requires a `DrawingDetail`. Drawing JSON, validation, status transitions, conflict semantics, and editor model ownership are unchanged.

## Verification

- Four fail-first save contracts initially failed against the predecessor path, then passed: guarded persisted revision, no-revision save, conflict metadata, and retained full-detail review wrapper.
- Focused final result: 12/12 save and CI-scope tests passed.
- Full unit result: 129 files, 762 tests passed.
- Full lint and standalone application-plus-test type-check passed.
- Guarded production build passed with source fingerprint `ade33732ba63817076f8b320ead4ef6752827898a0aebe1d3473bfac036734ed` and no source drift.
- Dedicated production in-flight test passed: the server persisted the first revision, its acknowledgment was held, a second canvas edit was made, the first acknowledgment left the editor dirty, and a second save completed normally.
- Complete local production drawing gate: 30/30 workflows passed, one worker, no retries.
- GitHub CI `33016170028` passed audit, lint, types, 762 units, isolated audit contracts, synthetic bootstrap, build, and all 30 production workflows for exact source SHA `3e636cabd1c39f6191b979f5d45c9b3b45e107f6`.

Retained negative evidence: the first in-flight browser run attempted ArrowRight while the Save button still held keyboard focus, so no canvas edit occurred and the test correctly failed. The corrected test explicitly refocused the canvas before editing; no runtime behavior was changed to turn that failure green.

## Measurements

The same 40-sheet SQLite fixture, five warmups and 30 samples:

| Save mutation | Median | p95 | Query count | Returned JSON |
|---|---:|---:|---:|---:|
| Stage 5 predecessor | 36.06 ms | 42.46 ms | 4 | 182,083 bytes |
| Compact acknowledgment | 21.95 ms | 26.11 ms | 3 | 62 bytes |

The mutation-level response is about 99.97% smaller, median about 39% lower, and p95 about 39% lower. The complete Server Action/RSC transport is deliberately measured separately in Task 020; this report does not equate the 62-byte mutation object with total network bytes.

## Recovery and risks

- Source checkpoint `3e636cabd1c39f6191b979f5d45c9b3b45e107f6` was publication-reviewed, pushed, and exact remote branch SHA verified.
- Stage 6 remains open until Task 020 passes; no verified-stage tag is assigned to this intermediate checkpoint.
- Conflict paths still require a second query for the latest revision by design.
- Approval still rereads full detail by design. Optimizing that distinct workflow is not required for normal editor saves and was not folded into this change.
