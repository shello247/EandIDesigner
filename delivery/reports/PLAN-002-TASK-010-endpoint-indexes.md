# PLAN-002-TASK-010 — Indexed endpoint and topology resolution

Start: 2026-08-26 14:58 America/Port_of_Spain
End: 2026-08-26 15:12 America/Port_of_Spain
Duration: approximately 14 minutes
Status: complete

## Scope and invariants

Index only the repeated endpoint/terminal lookups demonstrated inside electrical-network construction. Preserve encounter-order first match, linked-representation topology agreement, ambiguity findings, unresolved-endpoint attribution, electrical node/net membership and deterministic output. No model, database, public API, renderer or engineering identity changes.

Task009 predecessor: `5dfadf66d244978c9751712cc2d17ce5aeaadb08`, remotely verified.

## Change

Electrical-network construction now creates one first-resolved external-termination map keyed by sheet, connection and endpoint role. Endpoint resolution no longer materializes and scans the complete termination collection for every endpoint. The map is construction-scoped and preserves the prior `find` rule by setting a key only for the first resolved candidate in map encounter order.

Permanent-topology resolution now uses the graph's existing canonical terminal-ID map rather than materializing and scanning all terminal values twice for every topology key. The graph's terminal map already preserves the first linked terminal definition while reporting inconsistencies.

An initial candidate also pre-indexed every occurrence anchor. Broader fixture measurement showed that eager work was speculative for sheets where few anchors are queried. It was removed before final verification; ordinary anchor fallback remains the original first-terminal/first-anchor search. This is a deliberately rejected optimization, not hidden scope.

Files: electrical-network-index service and adversarial tests; an audit-only ABBA comparison; Delivery records. No external interface, engineering service, graph shape, drawing model, terminal/wire identity, database or renderer change.

## Correctness evidence

Four adversarial cases were added:

- duplicate anchor keys still resolve the first terminal and first anchor;
- an unresolved first anchor does not fall through to a later duplicate;
- unresolved external candidates are skipped and the first resolved candidate in encounter order wins;
- missing permanent-topology terminal keys retain their error finding.

Existing linked-topology disagreement, unresolved endpoint/panel attribution, transitive nets, deterministic provenance and path tests remain green. Focused final result: 12 tests across the electrical-network and release-fixture suites. Full result: 122 files and 724 tests passed. Full lint, standalone typecheck and guarded production build passed; final build ID `ppJ8VUoBb-icII7Cs-RZd`. Four production workflows passed with one worker/no retry: structured jumper author/remove/restore/reload, Wire Catalog lifecycle, internal-wire author/remove/re-represent/reload, and external-terminal mapping/reset.

The first standalone type run correctly rejected mutating a `ReadonlyMap` in test setup after the focused runtime test passed. The fixture now explicitly narrows the known test-created `Map`; the production graph interface remains read-only. That failed type attempt is retained.

## Measurement

All runs used the same guarded source fixture (120 sheets, 2,000 connections, 4,000 endpoints, 1,000 external terminations) with five warmups and thirty observations.

The direct ABBA comparison includes index construction on every indexed observation and checks identical first-resolved checksums (`120800`):

| Block order | Scan median / p95 | Indexed median / p95 |
|---|---:|---:|
| A | 57.30 / 59.33 ms | 4.42 / 5.15 ms |
| B (reversed) | 54.07 / 58.04 ms | 4.31 / 4.66 ms |

This isolates a repeatable approximately 92% reduction in the replaced endpoint-lookup work in both execution orders.

Complete electrical-network construction was noisier across independent batches: predecessor median/p95 `216.08/239.58 ms`; final refined candidate `179.39/243.31 ms`. An intermediate candidate was `189.08/221.97 ms`, while a separate candidate repeat was `215.76/245.28 ms`. Therefore the report attributes only the ABBA lookup reduction, not a stable complete-stage p95 gain. The existing 100 ms p95 electrical/source budget remains failed and visible.

Observed whole-graph medians for predecessor/final candidate were mixed10 `7.42/6.99`, mixed40 `28.70/22.78`, mixed120 `110.42/74.22`, dense `110.13/37.79` ms. Other stages in the later batch were also faster, so these are encouraging observations rather than solely attributable gains.

Evidence paths are guarded and ignored under `artifacts/drawing-performance/pass-1/`: `task010-baseline`, `task010-candidate`, `task010-candidate-repeat`, `task010-endpoint-abba`, `task010-candidate-refined`, focused/full/build/browser batches. Failures and outliers were not replaced.

## Risk and recovery

The index lives only for one electrical-network construction and grows with termination count. It does not retain editor/package state. Encounter-order behavior is explicitly tested. Topology lookup relies on the pre-existing canonical terminal-ID contract, with linked-definition mismatches still reported and failed closed.

Port3100 is released. The pre-existing live port3000 process remains PID31720 and was not restarted. Source checkpoint: commit containing this report; publication review, push and exact remote verification recorded at task close and in the next Delivery update.
