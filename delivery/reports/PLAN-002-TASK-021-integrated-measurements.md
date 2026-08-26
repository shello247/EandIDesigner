# PLAN-002-TASK-021 — Integrated regression and performance report

Start: 2026-08-26 18:00 America/Port_of_Spain

End: 2026-08-26 18:36 America/Port_of_Spain

Duration: approximately 36 minutes

## Result

The final candidate passes the complete drawing regression gate and materially improves every measured editing workflow against the frozen investigation baseline. The 40-sheet warm sheet-switch p95 is 129.60 ms, below the existing 250 ms budget. Selection, Properties, nudge, save, and connection-display actions are all substantially faster than baseline.

The integrated history test initially found a real candidate-only memory regression: weak caches were keyed by immutable model/source objects that the 50-entry undo stack intentionally retained. At 60 edits, forced-GC heap reached 135.30 MB. The correction keeps only the active prepared model and engineering snapshot, evicts superseded asset/placement render revisions by canonical identity, and preserves reuse for equivalent immutable render inputs. The final isolated run stays flat at 21.77 MB after 10 edits, 22.46 MB after 50, and 21.96 MB after 60. The exact 50 undo/50 redo contract remains intact.

No saved drawing, terminal identity, wire record, database schema, provider, dependency, save-conflict rule, or visible drawing behavior changed.

## Verification

Exact tested product fingerprint: `528deaa754e93b5da5a1873ef3714c4febef4630821465902a2325b1a1eecb02`.

- Full unit gate: 130 files and 771 tests passed.
- Full lint and standalone type-check passed.
- Guarded production build passed against the isolated synthetic SQLite target.
- Complete production drawing browser gate: 30/30 workflows passed, one worker, no retries.
- Twenty navigation/dialog/preview cycles passed; final mounted preview count returned to zero and never exceeded twelve.
- Fifty-entry undo/redo limit passed with stable DOM nodes and listeners.
- Diagnostic structural tests passed: selection, sheet navigation, preview, and lazy catalogue detail loading caused zero source/graph rebuilds; a real mutation caused exactly one source build, graph build, and history commit with zero network requests.
- Gesture diagnostics passed: one history commit per move/resize/rotate and zero pointer requests. Internal gesture-preview p95 was 0.10 ms, below the 16.7 ms budget.

## Interaction comparison

Production build, guarded 40-sheet fixture, five warmups and thirty measured samples:

| Workflow | Frozen baseline median / p95 | Final median / p95 | Existing budget |
|---|---:|---:|---:|
| Selection | 90.90 / 131.10 ms | 46.60 / 54.80 ms | report only |
| Sheet switch | 223.20 / 387.80 ms | 94.75 / 129.60 ms | 250 ms p95 — pass |
| Properties toggle | 61.60 / 170.10 ms | 34.20 / 35.40 ms | report only |
| Keyboard nudge | 319.70 / 539.60 ms | 133.80 / 147.70 ms | report only |
| Save | 485.80 / 784.60 ms | 151.00 / 173.30 ms | report only |
| Connection display | 367.04 / 482.10 ms | 183.87 / 207.88 ms | projection budget verified separately |

The final memory-safe nudge median is about 15.65 ms slower than the immediately preceding candidate measurement (118.15 ms), a retained and explicit tradeoff for removing approximately 113 MB of history-retained derived data at 60 edits. It remains about 58% faster than the original baseline median.

## Loading, geometry, and memory

Fresh-browser navigation medians improved from 1,189.65 to 538.98 ms (10 sheets), 1,502.49 to 766.87 ms (40 sheets), 2,988.43 to 1,358.69 ms (120 sheets), and 1,735.87 to 1,195.08 ms (dense sheet). Warm reload median/p95 improved for all four fixtures; the 120-sheet case fell from 2,049.69/5,672.80 ms to 1,100.58/1,134.69 ms.

Geometry medians improved from 627.30 to 256.90 ms for move, 384.00 to 268.90 ms for resize, 555.80 to 267.40 ms for rotate, and 326.10 to 128.60 ms for title edit. Browser long tasks remain around one per automated committed gesture even though measured pointer-preview calculation is below budget; this is retained as a rendering/automation observation rather than misreported as pointer work.

Across twenty UI cycles, forced-GC heap growth improved from 5.89 MB at baseline to 2.93 MB in the candidate. DOM nodes and listeners declined rather than growing, resources increased by one, and no preview SVG remained mounted after exit. The final isolated history run remained near 22 MB through 60 edits with 1,942 DOM nodes and 502 listeners.

## Retained negative and outlier evidence

- `task021-interactions-v1` and `task021-interactions-v3` correctly failed because an over-anchored Playwright grep matched no tests; both records are retained.
- `task021-history-v1` exposed the 135.30 MB regression. `task021-history-v2` proved the first correction reduced it but still plateaued near 56 MB.
- A combined interactions/history process recorded 55.35 MB because a hard 64-identity eviction discarded the package revision tracker. That implementation was removed, not waived. Finalization-backed cleanup preserves the active identity and the final isolated run remains flat.
- Gesture-level frame intervals and long tasks remain above a 16.7 ms frame in the automated multi-step runs. The dedicated internal pointer-preview calculation passes; end-to-end rendering has no existing pass threshold and remains visible for future work.
- Fresh-browser samples use ten contexts and are reported as median/range in raw evidence, not an invented p95.

## Evidence and recovery

Raw evidence is retained under `artifacts/drawing-performance/pass-1/`, including `task021-interactions-v2`, `task021-geometry-v1`, `diagnostic-task021-geometry-v1`, `task021-memory-v1`, `task021-navigation-v1`, all failed memory iterations, `diagnostic-task021-snapshot-v2`, `task021-cache-final-history-v3`, `task021-cache-final-interactions-v1`, and `task021-final-release-v2`.

Source checkpoint `11c91e71fd2ae522c2f4cf6d6732c1a9552fb58e` was publication-reviewed, pushed, and verified against the remote branch. Port 3000, the canonical database, the original worktree, and the Stage 6 recovery tag remain untouched.
