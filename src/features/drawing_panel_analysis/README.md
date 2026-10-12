# Drawing Panel Analysis

## PLAN-011 product checks

Saved drawing v3 selections feed explicit power budgets, signal/range checks,
terminal conductor/termination checks, dimension consistency and check-specific
information gaps. All calculations use pinned Item revisions, qualified Symbol
interfaces and existing canonical wiring. Partial coverage and engineering
assumptions remain visible. W/VA remain separate; DC power/current conversion
requires an applicable voltage. Physical identity deduplicates repeated views.

I/O schedules use explicit channel memberships and physical terminal numbers,
not label parsing. Sources and historical Item revisions can be opened from
findings/schedules. Membership never creates continuity. Nested artwork without
a canonical terminal projection reports missing wiring coverage explicitly.

`api/connection-contracts.ts` is the narrow browser-safe graph adapter; importing
the server-facing analysis barrel in a client component can pull database/BOM
dependencies into the browser. Both existing BOM paths share selected products.

`drawing_panel_analysis` is the read-only, saved-revision engineering review
workspace for drawing packages. It owns the Panel Analysis selector, analysis
contracts, deterministic rules, coverage reporting, root-cause grouping,
engineer-facing finding UI, drawing navigation targets, and schedule orchestration.

## Boundaries

- Analysis reads one saved `Drawing` and its exact pinned symbol dependency
  closure. It never mutates drawing JSON, symbols, terminals, wires, or status.
- One panel-wiring source, engineering snapshot, connectivity graph, and report
  index are shared for a projection.
- Error Detection is the default section. Terminals, Internal Wiring, and Assets
  reuse `drawing_panel_reports`; BOM templates load only when Materials/BOM is
  first opened and are guarded by the saved drawing revision.
- Findings contain stable rule/version identity, coverage, evidence level,
  significance, recommended action, affected records, and validated drawing
  locations. Inferred evidence cannot produce a confirmed error.
- Multiple-conductor findings reuse the package-wide terminal-side occupancy
  index used by the editor and save boundary. They identify the physical side
  and provide a separate drawing link for every contributing connection.
- Incomplete communication-path findings trace the saved electrical graph from
  the instrument to the actual open terminal side. Cards show the ordered
  terminal path, wire/cable/core identities, traversed sheets, and a drawing
  link at the stopping connection; internal graph net IDs are not displayed.
- Drawing deep links are checked against the saved model. A stale object target
  degrades to sheet focus; an unknown sheet is ignored safely.
- The first release has no repair, waiver, acknowledgement, issue, approval, or
  other mutation control. The underlying connectivity and narrow repair services
  remain separate internal capabilities for future workflows.

## Verification

```powershell
npm run test -- src/features/drawing_panel_analysis/tests/drawing-panel-analysis.test.ts
npm run test:e2e -- tests/e2e/drawing-panel-analysis.spec.ts --reporter=line --workers=1
npm run typecheck
npm run lint
```
