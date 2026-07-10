# Drawing Panel Wiring

`drawing_panel_wiring` owns the semantic electrical-connectivity foundation and
context-aware sheet presentation for Detailed Panel Drawings.

## Identity And Ownership

- `assetId` remains the identity of a physical panel, terminal block, device, or
  cable. A drawing occurrence never creates a second physical asset.
- A logical terminal is `{ assetId, terminalKey }`. A placement ID and anchor key
  describe a drawing occurrence, not terminal identity.
- Terminal sides are `external`, `internal`, or `single`.
- Existing field `DrawingConnection` records remain authoritative. External panel
  terminations are derived from them and retain sheet, connection, endpoint,
  placement, anchor, wire, cable, and conductor provenance.
- Internal wires have package-level identity. A future sheet route references the
  canonical wire through `DrawingConnection.panelConnectionId`.
- Jumpers/bridges and shield/earth bonds are structured package records rather
  than decorative or unrelated point-to-point lines.

`drawing_canvas` owns package persistence, sheets, placements, route geometry,
and existing field connections. This feature owns normalized panel semantics,
connectivity indexes, mappings, internal-wire records, bridges, bonds, and
validation.

## Public Boundary

`drawing_canvas` converts its model and approved/generated symbols into the
neutral `PanelWiringSourcePackage` DTO through
`drawing_canvas/api/panel-wiring-contracts.ts`. Domain services receive that DTO
and never import drawing-canvas internals.

Main public operations:

- `buildPackageConnectivityGraph`
- `getPanelConnectivitySnapshot`
- `getTerminalByRef`
- `getExternalTerminationProvenance`
- `validatePanelConnectivitySource`
- `inspectPanelConnectivity`
- `setPanelDrawingContext`
- `clearPanelDrawingContext`
- `upsertExternalTerminationMapping`
- `removeExternalTerminationMapping`
- `buildCompatiblePanelOptions`
- `getDetailedPanelDrawingContext`
- `validatePanelDrawingContext`
- `updateDetailedPanelDrawingContext`

Commands return typed mutations. The canvas applies those mutations through
`applyPanelWiringMutations`; callers and future AI agents do not edit raw drawing
JSON.

## Detailed Panel Drawing Sheets

- A Detailed Panel Drawing is a normal drawing-package sheet with an explicit
  `panelDrawingContext`. It uses the existing active-sheet canvas, history,
  Sheet Loader, Package Preview, print, and PDF paths.
- Reference Existing reuses one package panel or junction-box `assetId`. Create
  New adds one unplaced package asset and references it atomically with the new
  sheet; it does not generate an enclosure placement.
- The loaded workspace shows panel identity, type, purpose, and source-sheet
  traceability while suppressing field symbol placement and connection authoring.
- Asset Manager treats the sheet context as an association and blocks deletion
  of its referenced panel without increasing physical occurrence counts.
- Terminal import, internal-wire authoring, schedules, and connectivity QC are
  intentionally deferred to later phases.

## Compatibility And Performance

The v2 drawing model remains unchanged. `panelDrawingContext`, `panelWiring`, and
`panelConnectionId` are optional and remain absent until explicitly created. No
Prisma migration is required.

Graph construction is deterministic and linear in package assets, sheets,
placements, connections, and terminal definitions. It builds indexed `Map`/`Set`
views once per supplied model revision. React callers must memoize the normalized
source/graph and must not rebuild them during pointer movement.

Generated modular terminal blocks normalize `T1_TOP` and `T1_BOTTOM` into logical
terminal `T1` with external/internal capabilities. Approved symbols with one
anchor per terminal resolve as `single`; ambiguous metadata produces findings
instead of guessed mappings.

## Verification

```powershell
npm run test -- src/features/drawing_panel_wiring/tests/panel-connectivity-graph.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-wiring-compatibility.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/detailed-panel-context.test.ts
npm run lint
$env:DATABASE_URL='file:./dev.db'; npm run build
```
