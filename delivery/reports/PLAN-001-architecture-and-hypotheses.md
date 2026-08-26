# Drawing audit: execution paths and initial hypotheses

Scope: the dirty `codex/reliability-hardening` source snapshot identified in the run manifest. These are code-derived hypotheses, not timings. Measurements and final classifications belong in the assessment report.

## Execution map

| User workflow | Server/data boundary | Browser/engineering work | Evidence locations |
|---|---|---|---|
| Drawing list | `listDrawings`: one batched query, all non-archived `modelJson` values | Each document is parsed/normalized to derive sheet count; list rendered on server | `drawing_canvas/data/queries.ts`; `app/drawings/page.tsx` |
| Open package | Detail row first, then symbol versions and wire catalogue in parallel | Initial normalization/reconciliation; whole-package panel source; conditional graph; active-sheet SVG; edit overlays | `app/drawings/[id]/page.tsx`; `drawing-canvas-shell.tsx`; `svg-drawing-surface.tsx` |
| Select equipment | No intended database access | Selection state invalidates the engineering snapshot memo; dependent display/schedule projections can rebuild | Shell `panelEngineeringSnapshot` dependencies include `selectedPlacementId` |
| Move/resize/rotate | No intended database access during pointer movement | Transient gesture draft and animation-frame publication; normalization and a history entry on completion | Shell `commitModel`/history transaction; canvas gesture and geometry hooks |
| Edit identity, labels, notes | Local command/model update | Normalization, asset reconciliation, derived wire-ID reconciliation, panel-source rebuilding; source change invalidates graph | Shell `normalizeCanvasModel`; model/asset commands |
| Change connection display | Occurrence-specific command, no server call until save | Continuations/schedules updated atomically; canonical kinds projected through common wiring services | `drawing-connection-display-commands.ts`; placement context; connected schedule projection |
| Save | Catalogue/component validation, revision-checked update transaction, detail reread; full detail returned | Client normalization and serialization; caller consumes updated revision timestamp | `drawing_canvas/api/actions.ts`; `data/mutations.ts`; shell save handler |
| Package Preview | Existing client model, including unsaved edits | Graph/projections, per-sheet cache signatures, bounded SVG mounting/cache (12), no edit overlays | `package-preview-surface.tsx` |
| Print/PDF | Saved detail and symbols queried; package preparation repeated in separate routes | Shared SVG renderer and print-HTML builder; PDF launches Chromium, waits for content, prints and closes in `finally` | `app/drawings/[id]/{print,pdf}/route.ts`; `drawing-pdf-export.ts` |

Paths in this table are relative to `src/features/` unless they start `app/` (relative to `src/`). All refer to the frozen audit source, not a proposed architecture.

## Hypothesis register

| ID | Hypothesis | Confirmation/rejection method |
|---|---|---|
| H01 | Listing cost scales with package contents, although the UI only needs summary fields | 10/100/500 equally sized packages; query durations/counts versus total operation; returned versus stored bytes |
| H02 | Unused approved symbols increase load/save work | Fixed referenced version and package, catalogue sizes 25/250/1,000; actual query shapes and payload bytes |
| H03 | Selection rebuilds the full graph despite no engineering change | Thirty alternating selections; source/graph/network/projection/SVG invocation counts and long tasks |
| H04 | Whole-package normalization/source adaptation dominates small model edits | Compare title edits, nudges, geometry gestures and connection-display changes; count normalization and source passes |
| H05 | Electrical-network indexing contains scale-sensitive linear searches inside loops | Separate graph, validation and electrical-index CPU workloads; diagnostic CPU profile; inspect endpoint/topology lookups |
| H06 | There is an N+1 drawing query problem | Count actual list/detail/save SQL statements; do not equate Prisma batched relation queries with N+1 |
| H07 | Closed dialogs or collapsed Properties still do unnecessary work | Initial resource/DOM observations and open/collapse invocation matrix |
| H08 | Preview mounting/cache is unbounded | Existing unit bound plus twenty browser entry/exit cycles and mounted-SVG counts |
| H09 | Repeated preview/navigation retains memory indefinitely | Post-GC samples over twenty cycles; distinguish stable retention/GC from sustained growth |
| H10 | Print and PDF duplicate package preparation, and browser startup/readiness contributes export overhead | Shared-renderer code map, five sequential exports/size, diagnostic stage timings and HTML/text parity |
| H11 | Large orchestrators and cross-feature internal imports hinder safe performance work | TypeScript import inventory, runtime versus type-only boundary crossings, ranked extraction candidates |
| H12 | Existing performance metrics measure the whole perceived interaction | Compare state-setter timing with click-to-painted-sheet and gesture work with frame intervals/long tasks |

## Existing design strengths to preserve

- Structured, schema-validated drawing data and explicit canonical engineering identities.
- Feature-oriented data/API/logic/UI/test boundaries, pure geometry/projection services and command functions.
- Shared SVG renderer across edit, preview, print and PDF.
- Pinned symbol versions are distinguished from latest selectable versions; repeated asset occurrences are intentional.
- Transient pointer drafts, one history commit on gesture completion, and a fifty-entry history limit.
- Preview mounting and SVG cache bounded to twelve pages.
- Batched database access, singleton Prisma client and parallel symbol/wire catalogue fetch after detail resolution.
- Revision-conflict checks, engineering regression tests, and existing diagnostic budgets.

No architecture or optimization changes are implemented by this document.
