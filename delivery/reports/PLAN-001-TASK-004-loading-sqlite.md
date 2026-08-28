# PLAN-001-TASK-004 — Loading and SQLite

Status: complete with recorded limitations. Investigation only; not a claim that all tests/budgets pass.

Run: `20260826-baseline`. UTC command timestamps and durations are in the referenced `*-start.json` / `*-result.json` files. Work packages were interleaved; command durations are not exclusive task labor estimates. Local summaries use America/Port_of_Spain (UTC−04:00).

Measured corrected SQL observer batches with five warmups and thirty samples. At 500 small drawings the list operation took 3,227.67 ms median / 4,611.44 ms p95, while median summed SQL was 117.5 ms. The query transfers and parses 41,184,500 stored-document bytes to produce a 63,781-byte summary. No general N+1 pattern was demonstrated.

At 1,000 synthetic catalogue symbols the returned catalogue was 2,850,875 bytes despite one referenced version; median operation time was 232.85 ms. Pinned dependency probing found an omitted generated module-template version reference; preserve dependency closure before pruning catalogue payload.

Fresh-browser and warm navigation remain separate: drawable 120-sheet warm p95 was 5,672.8 ms; no cold OS/database-cache claim. Query plans use existing updatedAt and primary-key indexes. No query/index was changed.

Evidence: `sqlite-metrics.json`, `sqlite-query-plans.json`, `sqlite-runtime.json`, `browser-baseline-v2.json`, `pinned-module-dependency-probe.json`, `derived-summary.json`, scaling charts.

Verification: guarded `sqlite.ts`, `dependency-probe.ts` and browser `navigation` workload with unique result names.

Limitations: direct query timings exclude HTTP/rendering; SQL millisecond quantization can report zero. The original zero-query observer output is invalid for query conclusions and remains separately archived.

Raw evidence path: `artifacts/drawing-performance/20260826-baseline/`. Source/fixture definitions and hashes are shared with the main assessment and reproduction guide.

