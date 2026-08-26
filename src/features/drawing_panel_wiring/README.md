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
- Internal wires have package-level identity. A sheet-local visual route references
  the canonical wire through `DrawingConnection.panelConnectionId`.
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
- `getElectricalNetForTerminalSide`
- `listElectricalNetsForAsset`
- `listElectricalNetworkConnections`
- `traceElectricalPath`
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
- `buildPanelDiscoveryIndex`
- `buildPanelAssociatedAssetCatalog`
- `buildExternalTerminationCatalog`
- `buildPanelTerminalCatalog`
- `buildExternalTerminationMappingRows`
- `buildExternalTerminationMappingCandidates`
- `getTerminalSideOccupancy`
- `validatePanelTerminalMappings`
- `mapExternalTerminationToTerminal`
- `updateExternalTerminationMapping`
- `resetExternalTerminationMapping`
- `getExternalTerminationProvenance`
- `detectPanelDiscoveryWarnings`
- `inspectPanelDiscovery`
- `allocateInternalWireId`
- `validateInternalWireEndpoints`
- `createInternalPanelWire`
- `updateInternalPanelWire`
- `deleteInternalPanelWire`
- `buildPanelInternalWireCatalog`
- `getPanelWireSettings`
- `updatePanelWireSettings`

## Permanent Internal Topology And Electrical Nets

- Approved Registry metadata may declare versioned permanent continuity groups.
  These groups describe factory-installed passive conductors only; terminal
  function text is never parsed as connectivity.
- The runtime source projection carries topology from the exact renderable
  symbol used by the drawing. Structured terminal-strip groups are namespaced
  by permanent member token, for example `M02.1` and `M02.2`.
- Terminal body relationships join the supported sides of one logical terminal.
  Registry groups join logical terminals within one physical asset. Identical
  symbols used by different assets never become electrically common without an
  explicit wire, bridge, bond, or drawing connection.
- The graph builds deterministic runtime electrical nets with separate
  relationship provenance. Nets are recalculated from authoritative records and
  are never persisted into drawing JSON.
- Direct terminal-side occupancy remains authoritative for available/used
  status. Transitive net membership never consumes an unused terminal landing.
- Linked representations that disagree about topology fail closed with
  `linked_internal_topology_mismatch`; their Registry topology is excluded until
  repaired.
- Electrical-network query and deterministic path-tracing APIs remain available
  internally. The Properties network explorer and its interactive highlighting
  have been removed; a future drawing-analysis interface is deferred so the
  canvas stays focused on drawing authoring.

Commands return typed mutations. The canvas applies those mutations through
`applyPanelWiringMutations`; callers and future AI agents do not edit raw drawing
JSON.

Phase 10 agent-safe operations are revision-bound and digest-protected:

- `inspectPanelAgentContext`
- `listUnresolvedPanelTerminations`
- `proposeExternalTerminationMappingPlan`
- `proposeInternalWirePlan`
- `validatePanelAgentPlan`
- `applyApprovedPanelAgentPlan`

Agent proposals contain exact identity and occurrence references and are fully
revalidated before application. Approved/archived drawings, stale revisions,
disabled deployments, unsaved revisions, and unapproved SHA-256 digests are
rejected. This release provides no autonomous AI caller or agent UI.

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
- Terminal mapping, internal-wire authoring, schedules, and connectivity QC are
  intentionally deferred to later phases.

## Panel Discovery And Work Queue

- The active Detailed Panel Drawing builds one memoized `PanelDiscoveryIndex`
  from the package connectivity graph. React does not rescan package sheets while
  selecting, dragging, or rendering table rows.
- Associated assets are derived from physical containment and occurrence
  relationships. The catalog excludes cables, enclosures, and non-asset layout
  helpers and never relies on tag prefixes.
- External terminations are derived from authoritative field connections. Their
  provenance preserves connection, sheet, endpoint, placement, anchor, wire,
  cable asset, cable placement, cable tag, and conductor identity.
- The Panel Engineering Workbench reports `available`, `represented`, `missing`,
  `conflicting`, and `unsupported` records with deterministic disabled reasons.
- Placing an asset creates one drawing occurrence that reuses its existing
  `assetId`, tag, symbol/version, role, and terminal configuration. It does not
  add an asset, allocate a tag, or copy a field connection.
- Removing a representation returns the asset to the queue. Removal is blocked
  while a sheet-local connection references the occurrence so connectivity is
  never cascade-deleted by this workflow.
- A termination becomes represented when its target physical asset is represented.
  Phase 3 does not draw the external wire or persist a duplicate termination.

## Panel Engineering Workbench

- The Detailed Panel sheet opens one focused workbench for selecting existing
  panel equipment and reviewing its terminal, wire, and pattern records.
- The Equipment view is primary. It supports search, status filtering, individual
  Add actions, checkbox selection, Select all available, and one atomic
  Add selected to sheet operation.
- Detailed Panel equipment is initially allocated from the usable drawing center
  outward. `Center equipment` recenters all represented panel equipment as one
  group while preserving relative spacing, attached labels, and complete wire
  route geometry; notes and generated reference helpers remain fixed.
- The workbench reuses the established existing-asset placement, mapping, Wire,
  Pattern, Review, and Deliverables commands. It does not create alternate
  engineering records or new panel equipment.
- Legacy `workflowFocusAssetId` values remain loadable for compatibility, but the
  workbench does not expose or write guided-workflow focus or checklist state.

## Terminal Identity And Mapping

- Logical terminal identity is always `{ assetId, terminalKey }`. Anchor and
  placement IDs remain source-occurrence provenance and never become physical
  terminal identity.
- Generated terminal strips normalize `T*_BOTTOM` as `external` and `T*_TOP` as
  `internal`. Approved-symbol terminal metadata can declare `panelSide`; legacy
  single-anchor terminals continue to resolve as `single`.
- Repeated approved-symbol terminal keys resolve only when each anchor declares a
  unique `external` or `internal` side. Missing or duplicate side definitions are
  reported as ambiguous instead of being guessed from SVG orientation.
- Automatic external-termination mappings are derived from authoritative field
  connection anchors and are not persisted. Manual corrections store one
  `PanelTerminalMapping` override. Reset removes the override and returns to the
  inferred mapping when one exists.
- Field mappings may target any associated panel asset, but only an `external` or
  `single` terminal side. Internal, out-of-panel, missing, conflicting, and
  occupied targets are rejected with structured reasons.
- Terminal occupancy is indexed once per connectivity graph and separates
  conductor occupancy from structural jumper/bridge/bond occupancy. One
  conductor and one compatible structural relationship may coexist; conflicts
  within either channel remain loadable and are reported as repair work.
- The Panel Engineering Workbench contains Equipment, External Terminations,
  Terminal Map, Internal Wires, and Connection Patterns views. Mapping changes
  use typed mutations and one canvas history commit; they never alter or
  duplicate source field connections.

The backplane-oriented `drawing_panel_asset_placement` work queue remains a
separate physical-layout workflow. Detailed Panel discovery creates electrical
detail occurrences on a normal Detailed Panel Drawing and does not assign items
to a Backplane.

## Panel Equipment Boundary

- The panel layout and package asset inventory are authoritative for panel
  equipment. A Detailed Panel Drawing does not create breakers, relays,
  controllers, terminal blocks, or other physical devices.
- Existing panel equipment is discovered through `containerAssetId` and added to
  the Detailed Panel Drawing from the Panel Engineering Workbench. The occurrence keeps the
  same `assetId`, approved symbol/version, tag, and terminal metadata used by the
  physical layout.
- The Workbench derives a non-persisted physical position from the authoritative
  Backplane layout. Equipment is ordered by rail/free-placement row from top to
  bottom and then by its rotated left boundary from left to right. Moving panel
  equipment recalculates this position without changing asset or drawing data.
- A resolved asset-backed panel-layout occurrence is a valid representation
  source when no field-wiring occurrence exists. The Detailed Panel occurrence
  is generated at schematic scale and does not retain backplane layout fields.
- Electrical terminal and anchor metadata must resolve unambiguously before an
  existing component can participate in wiring.
- Deleting a Detailed Panel occurrence removes only that drawing reference. The
  physical asset and its panel-layout occurrence remain intact.
- Detailed Panel sheet duplication preserves all physical asset identities.
  Same-sheet component paste and cross-panel paste are blocked; a component may
  be referenced once on another Detailed Panel sheet for the same panel.
- Existing equipment must be represented and its terminals reviewed before
  internal connectivity is authored.

## Internal Wire Authoring

- A physical internal wire is stored once in `panelWiring.internalWires` using
  canonical `{assetId, terminalKey, side}` endpoints. Visual routes never define
  terminal or wire identity.
- Detailed Panel Wire mode accepts resolved `internal` and `single` terminal
  sides only. External sides, occupied sides, duplicate endpoint pairs, terminals
  outside the active panel, and ambiguous metadata are blocked before commit.
- New wires receive a permanent package-wide positive Wire number. It is shown
  with at least three digits (`001`, `999`, `1000`) and is never reused after
  deletion. The package sequence is independent of panels and pattern ownership.
- Wire ID is derived from the electrical source as
  `<source tag>:<source terminal>(<Wire #>)`, for example
  `MCB-101:1(001)`. Tag changes update this materialized display identity without
  changing the Wire number, stable record ID, route, or pattern reference.
- Detailed Panel canvas routes, Package Preview, print, and PDF display the
  complete derived Wire ID. Schedules and inspectors also retain Wire # as a
  separate field for sorting and reference.
- Every new wire selects one global Wire Catalog entry and stores an immutable
  type/size/color snapshot. Description remains separate engineer-entered text.
  Existing legacy free-text attributes remain readable.
- Creating a wire commits the canonical record and first orthogonal route in one
  history entry. Component movement keeps route endpoints attached to approved
  symbol anchors.
- Internal wires are authored directly on the sheet through Wire mode. New
  standalone wire forms prefill editable Description text from the existing
  numbered wire immediately before the proposed Wire number.
- Physical top/right/bottom/left position is shown only when it can be derived
  unambiguously from generated or approved-symbol anchor geometry.
- A physical wire can have one route occurrence on each Detailed Panel sheet for
  the same panel. The Internal Wires work-queue tab exposes unrepresented wires,
  route sheets, specification, findings, and representation actions.
- Removing a route preserves the physical wire and terminal occupancy. Deleting a
  physical wire is an explicit separate action that removes every route occurrence.
- Selected routes expose read-only Wire number and derived Wire ID, catalog
  specification selection, Description, route reset, and deletion in Properties.
  Endpoints remain read-only after creation.
- Canvas, Package Preview, print, and PDF use the same dark-blue internal-wire
  renderer. Detailed Panel sheets do not copy ordinary field connections; instead,
  represented equipment automatically receives non-interactive straight teal field
  stubs derived from canonical external terminations. Each stub remains linked to
  its source connection, wire/cable provenance, terminal side, and source sheet.
- Legacy internal wires remain unchanged until the explicit package upgrade is
  reviewed and applied. The upgrade preserves record IDs, routes, patterns,
  endpoints, descriptions, and legacy specification data.

## Connection Patterns, Shielding, And Earthing

- Jumpers, bridge bars, daisy chains, distribution groups, fused distribution,
  shield terminations, protective earth, and signal ground are canonical package
  records. Their sheet routes are representations, not the source of electrical
  identity.
- Structural jumpers/bridges and bonds do not create fake internal wires. Daisy,
  distribution, and fused-distribution patterns own the Phase 6 internal wires
  required by their topology; owned wires cannot be independently represented or
  deleted.
- Pattern IDs use per-panel monotonic counters such as `JMP-001`, `DC-001`, and
  `PE-001`. Deletion never rewinds a counter or reuses an identifier.
- Terminal metadata may declare `electricalDomains`. Unknown legacy terminals can
  accept their first known-domain assignment with a warning; explicit domain
  mismatches and later incompatible mixing are blocked.
- Conductor and structural occupancy are separate. Validated daisy intermediate
  terminals and distribution sources may carry pattern-owned fan-out while
  reporting that hardware capacity has not been verified.
- Generated shield, PE, and signal-ground references are movable non-asset
  placements. They never appear in Asset Manager or create physical package
  assets.
- A generated connection legend is created with the first represented pattern,
  can be moved or hidden, and is rendered by the same path in edit mode, Package
  Preview, print, and PDF.
- Pattern route removal preserves the canonical pattern and owned wires. Physical
  deletion explicitly removes the pattern, every owned wire, and every route
  occurrence in one history commit.
- Package-local pattern duplication requires explicit terminal mapping. It never
  guesses equivalent terminals or creates global placeholder templates.

## Connectivity Quality Control

- Panel Review derives deterministic findings from the package connectivity graph;
  it never inspects rendered SVG and does not persist a stale review snapshot.
- There is no standalone review action in the drawing toolbar. Existing blocked
  approval handling opens a review scoped to the affected physical panel;
  a dedicated approval workflow is deferred. Findings include stable subjects,
  source sheets, drawing objects, severity, and repair/navigation actions.
- Blocking errors cover identity conflicts, unresolved or over-occupied
  terminals, broken routes, invalid patterns, missing records, and panel-context
  mismatches. Warnings and information remain reviewable but do not block
  approval.
- Approved-symbol `requiredForWiring` metadata becomes side-specific review data.
  A generated feed-through terminal with an external field conductor also
  requires an internal-side connection.
- QC repairs are intentionally narrow: orphan or duplicate visual routes, stale
  or redundant mapping overrides, and unreferenced duplicate occurrences. Every
  repair requires confirmation and one drawing-history commit.
- Approval reruns package-wide panel QC on the server against the submitted model
  and current approved symbols. Any Detailed Panel blocking error preserves
  `needs_review`; field-only legacy packages retain their existing approval path.
- The graph and active-panel report are memoized per immutable model/symbol
  revision. Pointer movement and SVG rendering do not rerun package QC.

## Engineering Deliverables

- `drawing_panel_reports` consumes this feature's public connectivity graph to
  build terminal, internal-wire, panel-asset, and BOM deliverables.
- One logical terminal produces one schedule row with separate external,
  internal, and single-side occupancy, so conflicts remain visible in drafts.
- Report generation never parses SVG and never persists duplicate connectivity
  records. Internal-wire and pattern-owned wire identity remain canonical.
- Draft exports may expose blocking findings for engineering review. Issued
  exports require Approved status and a fresh package-wide QC run with no
  blocking findings.

## Compatibility And Performance

The v2 drawing model remains unchanged. `panelDrawingContext`, `panelWiring`,
`panelConnectionId`, and per-occurrence connection display are optional and
additive. `sheet_only`, `internal_connected`, `external_connected`, and
`all_connected` use the package connectivity graph to project existing
canonical rows onto a selected symbol occurrence. Generated sided terminals map
internal wires to TOP and external field connections to BOTTOM; generic and
single-sided symbols are filtered by canonical wire kind instead of geometry.
Projection never creates records or changes terminal occupancy. No Prisma
migration is required.

Graph construction is deterministic and linear in package assets, sheets,
placements, connections, and terminal definitions. It builds indexed `Map`/`Set`
views once per supplied model revision. React callers must memoize the normalized
source/graph and must not rebuild them during pointer movement.

`PanelEngineeringSnapshot` shares the validated source and graph across Work
Queue, Review, and Deliverables. Pattern validation uses one package index rather
than rescanning every wire and pattern for each member. Release performance and
manual procedures are in `docs/DETAILED_PANEL_RELEASE.md`.

Generated modular terminal blocks normalize `T1_TOP` and `T1_BOTTOM` into logical
terminal `T1` with internal/external capabilities. Approved symbols with one
anchor per terminal resolve as `single`; ambiguous metadata produces findings
instead of guessed mappings.

## Verification

```powershell
npm run test -- src/features/drawing_panel_wiring/tests/panel-connectivity-graph.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-wiring-compatibility.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/detailed-panel-context.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-associated-asset-catalog.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/external-termination-catalog.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-discovery-warnings.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-terminal-catalog.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/external-termination-mapping.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-terminal-occupancy.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-component-palette.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/internal-wire-allocation.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/internal-wire-validation.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-connection-patterns.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-pattern-validation.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/panel-agent-plans.test.ts
npm run test -- src/features/drawing_panel_wiring/tests/release-fixtures.test.ts
npm run test -- src/features/drawing_canvas/tests/drawing-panel-occurrence-commands.test.ts
npm run test -- src/features/drawing_canvas/tests/drawing-panel-component-commands.test.ts
npm run test -- src/features/drawing_canvas/tests/drawing-panel-wire-commands.test.ts
npm run test -- src/features/drawing_canvas/tests/drawing-panel-wire-renderer.test.ts
npm run test -- src/features/drawing_canvas/tests/drawing-panel-pattern-commands.test.ts
npm run test -- src/features/drawing_canvas/tests/drawing-panel-pattern-renderer.test.ts
npm run lint
$env:DATABASE_URL='file:./dev.db'; npm run build
npm run test:e2e -- tests/e2e/drawing-panel-discovery.spec.ts --reporter=line
npm run test:panel-perf
```
