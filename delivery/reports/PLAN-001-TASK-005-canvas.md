# PLAN-001-TASK-005 — Canvas and engineering processing

Status: complete with recorded limitations. Investigation only; not a claim that all tests/budgets pass.

Run: `20260826-baseline`. UTC command timestamps and durations are in the referenced `*-start.json` / `*-result.json` files. Work packages were interleaved; command durations are not exclusive task labor estimates. Local summaries use America/Port_of_Spain (UTC−04:00).

Measured thirty warm observations per main action on the 40-sheet fixture, separately from diagnostic counts. Warm sheet-switch p95 was 387.8 ms versus the existing 250 ms budget. Selection rebuilt the connectivity graph, electrical-network index, context and schedule without a model edit. Small model edits invoked source adaptation twice.

The separate source-only 120-sheet graph path had 1,228.41 ms p95 including validation and 440.64 ms electrical-network-index p95. CPU profiling points to natural ordering and repeated endpoint/index lookups. Benefits of specific replacements remain unmeasured.

Move/resize/rotate each committed exactly one history change and made zero HTTP requests. The internal preview callback metric is not full-frame cost; observed full-gesture long tasks prevent declaring the 16.7 ms frame budget passed.

Evidence: `cpu-metrics.json`, `source120.cpuprofile`, `browser-baseline-v2.json`, `browser-diagnostic.json`, browser CPU profile and invocation matrix in the assessment.

Verification: CPU harness and separate browser `interactions`, `geometry and identity`, profile and observer-overhead workloads.

Limitations: diagnostic runs were later and faster due uncontrolled conditions, not an optimization. Nested operation times are not additive. Dense-sheet direct SVG cost is measured; dense dragging was not separately benchmarked.

Raw evidence path: `artifacts/drawing-performance/20260826-baseline/`. Source/fixture definitions and hashes are shared with the main assessment and reproduction guide.

