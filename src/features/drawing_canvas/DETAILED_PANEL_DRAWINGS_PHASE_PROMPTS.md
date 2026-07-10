# Detailed Panel Drawings - Codex Phase Prompts

## How To Use This Pack

Execute these phases in order. Each prompt instructs Codex to inspect the current
repository and produce an implementation plan only. Review and approve that plan
before asking Codex to implement it. After implementation, run automated
verification, manually test the phase with JB001, correct defects, update the
documentation, and only then proceed to the next phase.

JB001 is the first acceptance fixture. Nothing in the implementation may contain
JB001-specific business logic, tags, IDs, assumptions, or hard-coded behavior.
Every service must work for any junction box, marshalling cabinet, distribution
panel, control panel, PLC/DCS cabinet, analyzer panel, or future enclosure type.

---

## Phase 1 - Domain Architecture And Connectivity Contract

```text
Please refresh yourself on the EI Designer drawing and asset architecture before
changing code.

Goal:
Produce a comprehensive programming implementation plan for the Detailed Panel
Drawings domain foundation. This phase establishes canonical terminology, data
ownership, schemas, public contracts, and pure services before any new drawing UI
is built.

Current context:
- Drawing packages use version 2 Drawing.modelJson with sheets, placements,
  connections, annotations, and package assets.
- assetId identifies one physical asset across multiple drawing occurrences.
- Field drawings, panel/enclosure containment, generated terminal blocks,
  backplanes, Associated Panel Assets, Sheet Loader, Package Preview, duplication,
  print, and PDF already exist.
- Panel layouts describe physical arrangement. Detailed Panel Drawings will
  describe electrical connectivity inside an enclosure.
- JB001 is only the first manual test fixture.

Requirements:
- Audit the current schemas and connectivity services before proposing changes.
- Define canonical concepts for panel context, asset occurrence, terminal identity,
  terminal side, external termination, internal wire, connection provenance,
  jumper/bridge, shield, earth, and source-sheet traceability.
- Preserve existing physical asset identity. Never duplicate assets merely because
  they appear on a detailed panel drawing.
- Establish a package-level connectivity graph that can be queried without React.
- Define a small public contract between drawing_canvas and a modular
  drawing_panel_wiring feature. Avoid sideways imports into feature internals.
- Use Zod for new persisted structures and pure deterministic services for graph
  construction and validation.
- Prefer optional backward-compatible Drawing.modelJson fields. Do not add Prisma
  changes or bump the drawing model version unless the audit demonstrates a real
  requirement and the plan explains migration behavior.
- Keep existing drawings, print/PDF, duplication, templates, and Asset Manager
  functional.
- Design explicit use cases suitable for future AI agents. Agents must call
  structured commands rather than editing raw drawing JSON.

Expected planning outputs:
- Feature Capsule for drawing_panel_wiring.
- Domain glossary and ownership rules.
- Proposed Zod schemas and public TypeScript interfaces.
- Connectivity/data-flow diagram.
- Exact scaffold/file map.
- Backward compatibility and migration strategy.
- Performance strategy for indexes/catalogs derived once per model revision.
- Unit, integration, and E2E test strategy.
- Small implementation chunks with verification commands.

JB001 acceptance fixture:
- Demonstrate how generic services will identify JB001, TB-101 through TB-104,
  existing field connections, source sheets, and wire IDs without hard-coded tags.
- Existing drawing behavior must remain unchanged after this phase.

Inspect at minimum:
- src/features/drawing_canvas/data/schema.ts
- src/features/drawing_canvas/logic/services/drawing-asset-identity.ts
- src/features/drawing_canvas/logic/services/drawing-connections.ts
- src/features/drawing_canvas/logic/services/drawing-identification.ts
- src/features/drawing_canvas/logic/services/drawing-terminal-blocks.ts
- src/features/drawing_panel_asset_placement/
- src/features/drawing_terminal_blocks/
- src/features/drawing_asset_manager/
- src/features/drawing_canvas/README.md

Do not implement code yet. Produce the plan, identify uncertainties and risks, and
wait for approval.
```

---

## Phase 2 - Detailed Panel Drawing Sheet Foundation

```text
Please refresh yourself on the EI Designer drawing canvas and the approved Phase 1
Detailed Panel Drawings architecture before changing code.

Goal:
Produce a comprehensive programming implementation plan for creating and editing a
Detailed Panel Drawing associated with a selected panel/enclosure asset.

Requirements:
- Add a professional Add Sheet workflow for Detailed Panel Drawing.
- Let the engineer select a compatible package panel/enclosure asset.
- Reuse the normal active-sheet drawing surface, Sheet Loader, undo/redo, save,
  Package Preview, print, and PDF architecture.
- Do not reintroduce the removed all-sheets edit viewport or a second heavyweight
  canvas renderer.
- Store explicit panel drawing context using the Phase 1 contract.
- A panel drawing must reference the existing physical panel asset. It must not
  create a duplicate panel unless the engineer explicitly chooses Create new.
- Add a clear readout for panel tag, title, type, source sheets, and drawing purpose.
- Context-aware sidebars and properties should activate only for the loaded panel
  drawing.
- Keep wiring authoring, terminal imports, internal wires, schedules, and QC out of
  this phase.
- Preserve old drawing packages and all existing field drawing behavior.
- Keep React state thin. Sheet creation and panel-context changes must use pure
  commands and the existing history/commit path.

Expected interfaces/use cases:
- createDetailedPanelDrawingSheet
- updateDetailedPanelDrawingContext
- getDetailedPanelDrawingContext
- buildCompatiblePanelOptions
- validatePanelDrawingContext

JB001 manual acceptance:
- Add a Detailed Panel Drawing for existing JB001.
- Verify the sheet references the existing JB001 assetId and tag.
- Save/reload, switch through Sheet Loader, open Package Preview, and verify PDF.
- Confirm no new JB001 asset appears in Asset Manager.

Inspect at minimum:
- Phase 1 contracts and README
- drawing-canvas-shell.tsx
- add-sheet-dialog.tsx
- drawing-sheet-commands.ts
- svg-drawing-surface.tsx
- sheet-loader-dialog.tsx
- package-preview-surface.tsx
- placement-properties-panel.tsx
- drawing-svg-renderer.ts

Plan tests for schema compatibility, sheet commands, active-sheet loading,
save/reload, preview, and export. Do not implement code yet. Produce the plan and
wait for approval.
```

---

## Phase 3 - Associated Panel Inventory And External Termination Discovery

```text
Please refresh yourself on the EI Designer panel drawing context and existing field
connection architecture before changing code.

Goal:
Produce a comprehensive programming implementation plan for discovering the assets
and external field terminations associated with the panel selected by the active
Detailed Panel Drawing.

Requirements:
- Build generic derived catalogs keyed by panelAssetId.
- Discover panel-contained assets, terminal blocks, breakers, controllers, relays,
  power devices, and other eligible equipment from package assets and placements.
- Discover field connections that terminate on assets associated with the panel.
- Preserve original connection IDs, wire IDs, cable IDs, conductor keys, terminal
  keys, source sheet IDs/names, and endpoint provenance.
- Distinguish an external termination record from an internal wire. Do not create
  internal wiring in this phase.
- Do not copy or recreate physical assets, field connections, or terminal blocks.
- Present a professional work queue/table showing available, represented, missing,
  conflicting, and unsupported records.
- Adding a representation to the detailed panel sheet creates a drawing occurrence
  or reference only. Removing that occurrence returns it to the available queue.
- Derive catalogs with Maps/indexes once per model revision. Avoid repeated full
  package scans during render or pointer interaction.
- Define clear disabled reasons when a record lacks terminal metadata or a suitable
  symbol.

Expected services/use cases:
- buildPanelAssociatedAssetCatalog
- buildExternalTerminationCatalog
- getExternalTerminationProvenance
- placePanelAssetOccurrence
- removePanelAssetOccurrence
- detectPanelDiscoveryWarnings

JB001 manual acceptance:
- Open the JB001 Detailed Panel Drawing.
- See TB-101 through TB-104 and every relevant field-side termination discovered
  from existing sheets.
- Verify cable/wire/source-sheet references are correct.
- Place and remove references without creating TB-105 or duplicate connections.
- Save/reload and verify the work queue remains correct.

Inspect existing Associated Panel Assets and Asset Manager behavior. Plan unit
tests using generic fixture IDs plus a JB001-like fixture. Do not implement code
yet. Produce the plan and wait for approval.
```

---

## Phase 4 - Terminal Identity, Sides, And Termination Mapping

```text
Please refresh yourself on the approved panel wiring contracts, terminal block
module, symbol anchors, and external termination discovery before changing code.

Goal:
Produce a comprehensive programming implementation plan for canonical terminal-level
connectivity in Detailed Panel Drawings.

Requirements:
- Define stable terminal references using physical asset identity plus logical
  terminal key. Drawing placement IDs must not define terminal identity.
- Represent terminal sides explicitly, including field/external and panel/internal
  sides where the hardware supports them.
- Map generated terminal strips and approved-symbol terminals into one public
  terminal contract.
- Preserve the rule that top/bottom graphical anchors may represent one logical
  terminal while still exposing side-specific connectivity.
- Map each discovered external field termination to the correct terminal and side.
- Show terminal number, terminal block tag, field wire/cable/conductor, source sheet,
  occupancy, and internal-side availability.
- Detect missing terminals, ambiguous mappings, duplicate occupancy, invalid sides,
  and terminal configuration disagreement across linked occurrences.
- Do not author internal wires yet.
- Keep mapping logic pure and deterministic. React should consume prepared rows and
  commands.

Expected services/use cases:
- createPanelTerminalRef
- buildPanelTerminalCatalog
- mapExternalTerminationToTerminal
- updateExternalTerminationMapping
- getTerminalSideOccupancy
- validatePanelTerminalMappings

JB001 manual acceptance:
- Inspect TB-101 through TB-104 and see numbered terminals with field-side wire
  provenance.
- Correct an intentionally unmapped/ambiguous termination through the UI.
- Confirm the internal side remains available for later wiring.
- Save/reload and verify stable mappings without duplicating field connections.

Plan schema compatibility, generated-terminal adapters, properties UI, tests, and
documentation. Do not implement code yet. Produce the plan and wait for approval.
```

---

## Phase 5 - Internal Component Placement And Asset Referencing

```text
Please refresh yourself on Detailed Panel Drawing context, package asset identity,
approved symbols, terminal contracts, and the normal drawing placement workflow.

Goal:
Produce a comprehensive programming implementation plan for placing internal panel
components on a Detailed Panel Drawing while preserving physical asset identity.

Requirements:
- Support internal devices such as breakers, fuses, relays, power supplies,
  isolators, converters, controllers, PLC/DCS I/O, earth bars, and terminal blocks.
- Use the approved Symbol Library and context-aware placement behavior.
- Let engineers reference an existing compatible package asset or create a new
  package asset with a unique global tag.
- Never create an asset for non-asset drawing helpers.
- Detailed panel electrical drawings may use readable schematic spacing and are not
  required to match the physical backplane scale. Preserve a traceable relationship
  to the same physical asset used in panel layouts.
- Define compatibility through metadata/capabilities, not hard-coded symbol names.
- Require terminal/anchor metadata before a component can participate in wiring.
- Show clear warnings for missing dimensions, missing electrical terminals,
  incompatible references, and duplicate tags.
- Reuse existing selection, move, rotate, copy/paste, undo/redo, properties, and
  asset-link behavior.
- Keep actual internal wire creation out of this phase.

Expected services/use cases:
- buildPanelComponentPalette
- buildCompatiblePanelAssetOptions
- placeExistingPanelAsset
- createAndPlacePanelAsset
- resolvePanelComponentTerminals
- validatePanelComponentPlacement

JB001 manual acceptance:
- Place/reference the existing terminal blocks and one representative internal
  component without duplicating assets.
- Confirm terminal metadata appears and the component can be arranged clearly.
- Save/reload, duplicate the sheet safely, and inspect Asset Manager associations.

Plan public symbol metadata requirements, dialogs, commands, tests, and migration
behavior. Do not implement code yet. Produce the plan and wait for approval.
```

---

## Phase 6 - Internal Wire Authoring And Routing

```text
Please refresh yourself on EI Designer connection routing, wire identification,
terminal sides, panel components, undo/redo, and SVG rendering before changing code.

Goal:
Produce a comprehensive programming implementation plan for authoring structured
internal panel wires between terminal-level endpoints.

Requirements:
- Internal wires connect canonical terminal references, not arbitrary screen points.
- Clearly distinguish internal panel wires from external field connections.
- Provide a professional connection-authoring flow with source endpoint, destination
  endpoint, proposed wire ID, wire attributes, and confirmation.
- Allocate unique package-aware internal wire IDs using a configurable policy.
- Permit manual wire ID overrides while preventing accidental duplicates.
- Reuse orthogonal route editing, route points, labels, undo/redo, copy/paste where
  valid, print, and PDF.
- Preserve endpoint attachment while components move.
- Prevent invalid connections, including same-side misuse, incompatible terminals,
  unavailable terminal occupancy, and references outside the active panel context.
- Define deletion semantics carefully: deleting a visual route must not silently
  delete an external field connection or physical asset.
- Keep high-frequency pointer movement transient and commit once per gesture.
- Keep routing calculations indexed to the active sheet only.

Expected services/use cases:
- createInternalPanelWire
- updateInternalPanelWire
- deleteInternalPanelWire
- allocateInternalWireId
- validateInternalWireEndpoints
- buildPanelWireRoute
- getPanelWireDisplayLabel

JB001 manual acceptance:
- Connect internal sides of representative JB001 terminals to another internal
  component/terminal.
- Verify external field wiring remains unchanged and visually distinguishable.
- Move components and edit routes without breaking endpoints.
- Undo/redo, save/reload, print, and PDF the internal wiring.

Plan the data model, commands, interaction states, rendering layers, validation,
tests, and performance controls. Do not implement code yet. Produce the plan and
wait for approval.
```

---

## Phase 7 - Jumpers, Distribution, Shielding, And Earthing

```text
Please refresh yourself on the Detailed Panel Drawing terminal graph and internal
wire authoring implementation before changing code.

Goal:
Produce a comprehensive programming implementation plan for common panel connection
patterns that cannot be represented professionally as unrelated point-to-point
wires.

Requirements:
- Support terminal jumpers/bridge bars, daisy chains, power/common distribution,
  fused distribution, shield termination, protective earth, and signal ground.
- Represent these as structured electrical relationships with deterministic IDs and
  terminal membership, not decorative lines.
- Reuse existing terminal references and internal wire endpoints.
- Render jumpers, commons, shields, and earth connections with distinct technical
  styles and a clear legend where needed.
- Prevent incompatible domain mixing, duplicate bridge membership, loops that violate
  configured rules, and multiple exclusive earth/shield terminations.
- Allow reusable connection patterns/templates only when their asset and terminal
  resolutions are explicit.
- Keep the first release focused on generic constructs; do not hard-code vendor PLC,
  relay, or terminal product behavior.
- Preserve schedules/report readiness and source provenance.

Expected services/use cases:
- createTerminalJumper
- createDistributionGroup
- addTerminalToDistribution
- createShieldTermination
- createEarthTermination
- validatePanelConnectionPattern
- renderPanelConnectionPattern

JB001 manual acceptance:
- Add a representative terminal jumper and earth/shield termination where valid.
- Confirm ordinary field and internal wires remain intact.
- Verify invalid duplicate membership is blocked or clearly reported.
- Save/reload and verify print/PDF output.

Plan schemas, commands, technical rendering, properties UI, tests, and future
extensibility. Do not implement code yet. Produce the plan and wait for approval.
```

---

## Phase 8 - Connectivity Quality Control And Engineering Review

```text
Please refresh yourself on the complete Detailed Panel Drawing connectivity graph,
field terminations, terminal mappings, internal wires, and connection patterns
before changing code.

Goal:
Produce a comprehensive programming implementation plan for deterministic panel
connectivity quality control and a professional engineering review workflow.

Requirements:
- Build QC from structured graph data, never by parsing rendered SVG.
- Detect duplicate asset tags, duplicate wire IDs, missing assets, missing terminals,
  incompatible terminal sides, over-occupied terminals, orphaned references,
  unresolved external terminations, unconnected required terminals, invalid jumpers,
  broken route endpoints, panel-context mismatches, and inconsistent linked assets.
- Classify findings as blocking error, warning, or information.
- Findings must identify affected asset/terminal/wire, sheet number/name, source
  drawing, and a deterministic repair action where possible.
- Add an application-wide Panel Drawing Review dialog/panel with filters and direct
  navigation to the affected sheet/object.
- Do not mutate engineering data automatically without explicit engineer approval.
- Expose pure QC services and agent-readable result types.
- Cache/index graph construction per model revision and avoid rerunning full-package
  QC during pointer movement.
- Integrate save/approval safeguards without preventing legacy drawings from opening.

Expected services/use cases:
- buildPanelConnectivityGraph
- runPanelDrawingQualityChecks
- groupPanelDrawingFindings
- navigateToPanelFinding
- applyApprovedPanelRepair
- canApprovePanelDrawing

JB001 manual acceptance:
- Introduce controlled duplicate, missing, and over-occupied terminal conditions.
- Verify findings point to the correct JB001 assets, terminals, wires, and source
  sheets.
- Repair each issue and confirm the review becomes clean.
- Save/reload and confirm deterministic results.

Plan severity policy, UI, public result types, tests, performance, and approval
integration. Do not implement code yet. Produce the plan and wait for approval.
```

---

## Phase 9 - Terminal Schedules, Wire Schedules, BOM, And Export

```text
Please refresh yourself on the completed panel connectivity graph, QC services,
Asset Manager, BOM Creator, and drawing print/PDF architecture before changing code.

Goal:
Produce a comprehensive programming implementation plan for generating engineering
deliverables from Detailed Panel Drawing data.

Requirements:
- Generate deterministic panel terminal schedules showing terminal tag/number,
  field-side wire/cable/conductor, internal-side wire, connected device/terminal,
  jumper/common membership, shield/earth information, and source sheets.
- Generate internal wire schedules with wire ID, endpoints, panel, route metadata,
  size/color/type where available, and provenance.
- Add panel asset/BOM views derived from package assets and placed components without
  creating duplicate item records.
- Define explicit integration contracts with BOM Creator rather than importing its
  internals.
- Provide professional table UI, filtering, sorting, CSV/XLSX-ready structured data,
  and print/PDF sections as appropriate.
- Keep drawing PDF behavior stable; add schedules through deliberate package options,
  not accidental extra pages.
- Block issued deliverables only for QC findings classified as blocking.
- Ensure all reports are generated from the connectivity graph and remain consistent
  with the drawing.

Expected services/use cases:
- buildPanelTerminalSchedule
- buildPanelWireSchedule
- buildPanelAssetSchedule
- buildPanelBomProjection
- exportPanelScheduleData
- renderPanelScheduleForPrint

JB001 manual acceptance:
- Generate JB001 terminal and internal wire schedules.
- Trace selected schedule rows back to field sheets and detailed panel objects.
- Confirm counts, wire IDs, terminal sides, and asset tags match the drawing.
- Verify save/reload, print/PDF, and structured export.

Plan public report types, BOM boundaries, table components, export behavior, tests,
and performance. Do not implement code yet. Produce the plan and wait for approval.
```

---

## Phase 10 - Performance, AI Readiness, End-To-End Hardening, And Release

```text
Please refresh yourself on every completed Detailed Panel Drawing phase and the
current EI Designer performance architecture before changing code.

Goal:
Produce a comprehensive programming implementation plan for performance hardening,
workflow polish, AI-agent readiness, documentation, and release validation of the
complete Detailed Panel Drawings initiative.

Requirements:
- Profile real panel drawing workflows before optimizing.
- Keep edit mode active-sheet-only and Package Preview lazy/read-only.
- Ensure graph catalogs, asset indexes, terminal indexes, and QC are memoized or
  cached by stable model revision and never rebuilt on every pointer event.
- Use transient drag/route previews with one model commit per completed gesture.
- Review React rendering boundaries, large tables, SVG complexity, connection-route
  calculations, keyboard handlers, and dialog state.
- Add loading, empty, error, disabled, conflict, and recovery states throughout the
  workflow.
- Expose structured deterministic use cases for future AI agents: discover panel
  context, list unresolved terminations, propose mappings/wires, validate plans, and
  apply only explicit approved commands.
- Agents must never silently infer physical asset identity or modify issued drawings.
- Complete README/domain documentation, public API documentation, data examples,
  manual test scripts, and troubleshooting guidance.
- Add focused Vitest coverage and a stable Playwright JB001 end-to-end workflow.
- Verify existing field drawings, panel layouts, templates, duplication, Asset
  Manager, schedules, BOM, print, and PDF remain functional.

JB001 release acceptance:
- Create/load the detailed panel drawing.
- Discover existing assets and external terminations.
- Map terminal sides.
- Place internal components.
- Author internal wires and connection patterns.
- Resolve QC findings.
- Generate schedules and PDF output.
- Save/reload and repeat key actions without duplicates or performance degradation.

Also define a second generic fixture with different tags, terminal counts, and panel
type to prove that no JB001-specific behavior exists.

Expected planning outputs:
- Profiling findings and measurable performance targets.
- Prioritized optimization list.
- Complete automated/manual regression matrix.
- AI-agent public use-case contract.
- Documentation/file updates.
- Release checklist, rollback considerations, and known future enhancements.

Do not implement code yet. Produce the plan and wait for approval.
```

