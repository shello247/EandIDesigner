# PLAN-002-TASK-012 — Shared normalized model and final derived source

Start: 2026-08-26 15:20 America/Port_of_Spain
End: 2026-08-26 15:36 America/Port_of_Spain
Duration: approximately 16 minutes
Status: complete; checkpoint remotely verified

## Invariants

One committed model preparation may return normalization/reconciliation output and its validated panel-wiring source together. If reconciliation changes derived wire IDs, the source must be rebuilt from and describe the final model. Untrusted input/persistence validation stays intact. Undo/redo, history coalescing, dirty/save/conflict behavior and all engineering identities remain unchanged.

Predecessor: `875686a154444404e176b0e3a4029f4d8d0f07f7`, remotely verified.

## Demonstrated duplicate path

The predecessor normalized assets, constructed a panel-wiring source to reconcile derived wire IDs, discarded that source, and then constructed the same source again for rendering. Every committed gesture repeated that pair. Save called the same normalizer again even though the editor model was already normalized. A Server Action response could also re-serialize an unchanged symbol array, invalidate the source memo by reference and rebuild it after Save.

The accepted preparation service returns the normalized/reconciled model together with the source that describes it. It uses an editor-scoped `WeakMap` keyed by immutable model revisions. A no-mutation preparation reuses its first source; a wire-ID reconciliation deliberately rebuilds once from the final mutated model and caches both the input and final identities. There is no process-global cache or unbounded package retention.

The React cache dependency uses a deterministic key over the symbol engineering fields consumed by preparation. This preserves the cache when an unchanged Server Component payload arrives as a fresh array while invalidating for changed metadata, category, identity or display fields. SVG is intentionally outside this engineering-source key; render preparation remains Task013. The exact symbol-version and catalogue split remains Stage4.

## Correctness contracts

New unit coverage proves:

- an ordinary model constructs one source and returns the same prepared result for its input and final model identities;
- a stale internal-wire ID is reconciled to `K-900:OUT(001)`, the source is rebuilt from the final model, and the returned source contains that final ID;
- equivalent fresh symbol arrays produce the same dependency key, ordering does not affect it, and changed engineering metadata invalidates it.

The shell now consumes the shared result for initial state, ordinary commits, completed gestures, rendering, Save and the dormant approval path. Existing persistence validation remains at the Server Action/data boundary. No drawing schema, JSON, database, public API, terminal/wire identity, conflict rule or history limit changed.

## Production diagnostic

On the deterministic 40-sheet fixture, the final production diagnostic recorded:

| Action | Settled interaction | Normalize | Source | Graph | History | Requests |
|---|---:|---:|---:|---:|---:|---:|
| Select equipment | 60.7 ms | 0 | 0 | 0 | 0 | 0 |
| Switch sheet | 143.3 ms | 0 | 0 | 0 | 0 | 0 |
| Enter Package Preview | 113.3 ms | 0 | 0 | 0 | 0 | 0 |
| Commit ArrowRight move | 180.0 ms | 1 | 1 | 1 | 1 | 0 |
| Save committed model | 248.4 ms | 0 | 0 | 0 | 0 | 1 |

The mutation's single preparation measured 40.6 ms, of which its one source build measured 32.0 ms; its graph build measured 12.9 ms. These are structural single observations, not a timing distribution. The predecessor's code path performed two source adaptations per normal mutation (one inside normalization and one for rendering); the final candidate performs one and shares it. Save now performs zero preparation/source/graph work when model and symbol engineering dependencies are unchanged.

## Verification

- Focused preparation/wire/identity checks passed; the final new service suite has 3 tests.
- Full regression: 124 files and 729 tests passed, including save-concurrency, history and engineering suites.
- Full lint, standalone typecheck and guarded production build passed. Final build ID: `j3IIhdXwm4_ddqyJtwYXA`; source fingerprint `c28db2dac2856c2f4fe8b47a4d93f00cfcf40db547c01792945e170db2c2ff4e`.
- Production diagnostic `diagnostic-task012-preparation-v3` passed with the counts above.
- Five affected production browser tests passed with one worker/no retry: structured jumper author/remove/restore/reload, Wire Catalog lazy lifecycle, internal-wire author/remove/re-represent/reload, external-terminal map/persist/reset and selection align/distribute/save/reload.
- Port3100 was released. The existing live port3000 process was not restarted; the canonical database was never targeted.

## Retained failures and corrections

`diagnostic-task012-preparation` first proved that a successful Save still recorded one normalize call. The initial preparation had been held in a `useMemo` keyed by `drawing.model`; a Server Action response supplied a fresh prop identity. Moving only the one-time initial preparation into the state initializer removed that false dependency without bypassing the assertion.

`diagnostic-task012-preparation-v2` then proved one remaining source rebuild. The unchanged symbol bundle was also re-serialized as a fresh array. The semantic engineering-dependency key fixed that demonstrated invalidation; v3 passes all zero-rebuild assertions. Neither failed assertion was weakened.

`task012-browser-v1` invoked the reusable test-only configuration that intentionally has no web server. All five tests failed closed with `ERR_CONNECTION_REFUSED`; no product assertion ran. The corrected `task012-browser-v2` used the guarded production-server configuration and all five passed. Both records are retained rather than replacing the invocation error.

## Risk and recovery

Model caches are editor-local and weak-keyed. Symbol dependency-key construction occurs only when the Server Component supplies a new array identity; ordinary client state renders reuse React's memo. The key includes every symbol field used by asset/source normalization except SVG, while the complete render dependency and generated-geometry identity are explicitly left for Task013. Reconciliation remains conservative and rebuilds the source from the final model whenever it changes IDs.

Raw evidence remains in unique ignored `task012-*` and `diagnostic-task012-*` paths. Publication review scanned the complete 10-file staged set with zero findings. Source checkpoint `d42fe9cbbdbcb7a1bec4ffb7c3bf5e087ed4b94e` was pushed and matched the exact remote branch SHA.
