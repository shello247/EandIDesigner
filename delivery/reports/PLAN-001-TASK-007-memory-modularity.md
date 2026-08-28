# PLAN-001-TASK-007 — Memory and modularity

Status: complete with recorded limitations. Investigation only; not a claim that all tests/budgets pass.

Run: `20260826-baseline`. UTC command timestamps and durations are in the referenced `*-start.json` / `*-result.json` files. Work packages were interleaved; command durations are not exclusive task labor estimates. Local summaries use America/Port_of_Spain (UTC−04:00).

Twenty navigation/preview/dialog/selection cycles showed post-GC heap stabilizing around 19–21 MB after warmup, with stable documents/listeners and no monotonic DOM growth. This does not establish a leak. Sixty alternating-asset edits verified the fifty-entry undo limit and all fifty redo steps. The first same-asset history test incorrectly ignored intended 900 ms coalescing; its failure is preserved.

Static review counted 246 drawing production files / 68,778 lines and 37 runtime cross-feature nonpublic imports after honoring the existing api/* convention. Large shell/inspector/surface modules are review targets, not performance defects by size alone.

Preserve bounded preview SVG/cache behavior, transient gesture state, immutable identities and shared SVG rendering. Distinguish duplicate computation from intentional repeated occurrences; no duplicate canonical engineering-data claim is supported.

Evidence: `browser-baseline.json` memory section, `browser-baseline-history-v3.json`, `modularity.json`, architecture map and backlog.

Verification: browser `memory` / `history limit and memory`, plus `static-audit.mjs`.

Limitations: twenty cycles are not a long soak or a complete heap-retainer investigation. A blanket claim that every collapsed card performs expensive work was not confirmed; the closed Wire Catalog is a specific identified case.

Raw evidence path: `artifacts/drawing-performance/20260826-baseline/`. Source/fixture definitions and hashes are shared with the main assessment and reproduction guide.

