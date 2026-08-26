# PLAN-002-TASK-015 — Batched render bundle and catalogue summaries

Start: 2026-08-26 16:11 America/Port_of_Spain
End: 2026-08-26 16:22 America/Port_of_Spain
Duration: approximately 11 minutes
Status: verification complete; recovery checkpoint pending

## Invariants

The render bundle must contain only explicitly requested exact versions,
preserve historical non-latest versions, omit missing versions without
substitution and remain independent of unused catalogue size. The catalogue
summary must retain the fields required for grouping and filtering without
shipping SVG, anchors, terminals or component definitions. Existing full
catalogue callers remain available until their deliberate Task017 migration.

Predecessor: `eb211f58d14178c2a70adda768cfb9458ec82607`, remotely verified.

## Reproduction and test-first evidence

Five data-layer contracts were added before the interfaces existed. The first
red run produced five failures: four expected missing-contract/query failures
and one invalid synthetic terminal-strip fixture. The fixture was corrected to
obey the existing electrical-member terminal invariant, after which the second
red run retained exactly the four expected missing-interface failures while
the legacy full-catalogue assertion passed. These failures remain part of the
task transcript and were not replaced by the green run.

The contracts prove:

- trimmed, deduplicated and bounded exact-version requests;
- direct `SymbolVersion` queries with no whole-symbol catalogue query;
- 400-ID chunks below the SQLite parameter limit;
- deterministic requested-ID ordering and omission of missing versions;
- lightweight latest-version catalogue summaries without SVG/full metadata;
- the unchanged full-catalogue function remains callable and returns full
  render records.

## Change

The symbol registry now exposes Zod-backed internal/public contracts for exact
drawing version IDs and catalogue summaries. `listDrawingSymbolVersionsByIds`
queries only requested non-network versions, in 400-ID batches, then restores
the deduplicated request order. It intentionally does not filter version
status, matching the prior pinned-version behavior for historical records. It
does not substitute the latest version when an exact ID is missing.

`listDrawingSymbolCatalogSummaries` queries the latest approved non-network
version for each approved symbol but projects only identity, managed category,
technical kind, version identity and compact layout/terminal capabilities.
Metadata JSON is parsed server-side to preserve existing library grouping
semantics; the returned object omits SVG, view boxes, anchors, terminals,
component positions and electrical topology.

Public wrappers `listDrawingRenderSymbols` and
`listDrawingSymbolCatalogSummaries` make the split available for Tasks016–017.
The existing `listSymbolsForDrawing` and `listApprovedSymbolsForDrawing`
functions and their callers were not migrated or changed in this task.

## Same-run scaling comparison

The guarded SQLite workload used five warmups and thirty measured iterations at
25, 250 and 1,000 synthetic catalogue symbols with one referenced version.

| Catalogue size | Legacy full median / bytes | Exact bundle median / bytes | Summary median / bytes |
|---:|---:|---:|---:|
| 25 | 4.39 ms / 94,550 | 0.99 ms / 2,829 | 3.93 ms / 10,248 |
| 250 | 29.10 ms / 730,625 | 1.01 ms / 2,829 | 24.75 ms / 89,898 |
| 1,000 | 111.55 ms / 2,850,875 | 0.95 ms / 2,829 | 94.76 ms / 355,398 |

At 1,000 symbols, the exact bundle is approximately 99.0% lower by median and
99.9% smaller by returned bytes than the legacy full result. Its time and bytes
remain effectively flat as unused catalogue size grows. The complete summary
payload is approximately 87.5% smaller than full records. Summary time still
scales with catalogue size because every catalogue item is intentionally
represented; this task makes no contrary claim.

Prisma relation hydration produces three captured queries for the one-version
exact bundle and four at the 1,000-item summary. Exact query count remains
constant across catalogue sizes. No index/schema/provider change was made.

The same audit also retained drawing-list 10/100/500 and detail/save samples.
Their existing scaling is outside Task015 and was not relabelled as improved.

## Files changed

- `src/features/symbol_registry/data/schema.ts`
- `src/features/symbol_registry/data/queries.ts`
- `src/features/symbol_registry/api/public.ts`
- `src/features/symbol_registry/tests/drawing-symbol-queries.test.ts`
- `scripts/drawing-performance-audit/sqlite.ts`
- Delivery OS task/current/report records

## Verification

- Focused data contracts: 1 file, 5 tests passed.
- Full unit suite: 127 files and 740 tests passed.
- Full lint and standalone application/test typecheck passed.
- Guarded synthetic bootstrap, real-Prisma 5+30 scaling run and production
  build passed. Candidate source fingerprint:
  `d5118c29d717a5ed6162fff527364440e803e29cabc927ab459cb497bacd4dd0`;
  build ID: `tvjFW8iDN0bWhAemSz_zp`; source drift: false.
- Four production browser workflows passed serially with one worker and zero
  retries: panel component placement/reload, PDF preview, selection
  arrangement and modular terminal-group creation.
- Port 3100 was released. Live port 3000 remains PID 31720 and was not
  restarted; the canonical database was never targeted.

## Risks and follow-up

The summary query still reads metadata JSON inside the server process because
the current SQLite schema stores layout capabilities in that document. This is
an intentional no-migration compromise: it removes large SVG/full metadata
serialization from the response but does not claim zero metadata-read cost.

No current UI consumes summaries yet. Task016 adds deduplicated on-demand full
record loading and explicit error/retry behavior. Task017 then migrates editor,
save, preview, print and PDF consumers and repeats catalogue scaling against
the actual initial payload.

## Recovery

Raw metrics, build and browser evidence remain in ignored unique
`task015-query-split-v1`, `task015-build-v1` and `task015-browser-v1` paths.
Publication review, source checkpoint SHA and exact remote verification:
pending.
