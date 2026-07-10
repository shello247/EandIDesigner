# Drawing Canvas

`drawing_canvas` is the model-driven engineering drawing workspace. It is the
current primary application module.

The canvas renders A3 landscape wiring sheets from registry symbols
and a structured `DrawingModel` package. It is intentionally not a freeform
SVG/vector editor.

## Current Status

The current sheet milestone is complete enough to pause and move to the next
application stage.

Supported now:

- Drawing list, creation, deletion, save, and manual approval.
- Approved symbol library panel.
- Add Symbol dialog with package-wide tag allocation and existing-asset
  references for devices.
- Symbol placement, drag, resize, delete, scale, rotation, and asset tag
  editing.
- Placement tag/title labels for every draggable symbol type.
- Purple placement label handle that moves the tag/title pair together.
- Active-sheet edit workspace with Fit, 100 percent, zoom in/out, Ctrl+wheel
  zoom, and Sheet Loader navigation for switching sheets.
- Read-only Package Preview mode for reviewing all sheets in order without
  mounting edit overlays or sidebars.
- Anchor hover data.
- Click-click connection authoring between anchors.
- Grouped connection panel by transition, for example `TT-101 <-> C-101`.
- Wire IDs, conductor keys, cable placement references, and connection labels.
- Manual orthogonal route editing with route points, route-point deletion, route
  label yellow handles, and route reset.
- Note blocks with editable title/body in the right panel.
- Optional note leader arrows and draggable note leader target.
- Arrow-key nudge by 1 mm for selected movable canvas items.
- Collapsible title block editor.
- Floating green toast notifications.
- Multi-page package PDF preview via `/drawings/[id]/pdf`.
- Browser print preview for all package sheets via `/drawings/[id]/print`.
- Multi-sheet drawing packages with isolated placements, connections, routes,
  and notes per sheet.
- Active sheet name and description editing in the right properties panel.
- Asset identity editing in the right properties panel, including linked asset
  tag updates across sheets and non-blocking duplicate tag warnings.
- Drawing-level Asset Manager dialog for package assets, grouped by engineering
  type with sheet associations and unplaced asset creation/deletion.
- Duplicate Sheet wizard for one-sheet-at-a-time copies with reviewed asset
  creation/reference decisions.
- Generated panel/enclosure placements, including package-wide panel asset
  references such as `PDP-101`.
- Explicit panel containment for devices and terminal assets shown inside a
  visible enclosure on a sheet.
- Generated configurable terminal block strips such as `TB-101`, with
  package-wide asset identity, editable terminal count/start number, and
  generated top/bottom terminal anchors.
- Programmable Backplanes for panel-layout work on normal drawing sheets. A
  backplane is a generated Symbol Library item under Panel Layout, not a
  physical asset.
- Scaled physical panel layouts: backplanes store real millimetre dimensions and
  render at a standard drawing scale such as `1:2` or `1:10`.
- Associated Panel Assets work queue for placing existing panel assets, such as
  `TB-101` through `TB-104` already assigned to `JB001`, onto a backplane
  without creating duplicate physical assets.
- Manual horizontal and vertical Backplane dimensions with physical-mm values,
  independent witness feet, dimension-line and label controls, and magnetic
  edge attachment to Backplanes and layout items.

Intentionally not supported in the current drawing workflow:

- Public drawing validation action/UI.
- Drawing archive action/UI.
- SVG export action/UI.
- Global auto-route all.
- Bundle view or generated cable bundle geometry.
- Full cable/termination schedule pages.
- Cross-sheet wiring connections and off-sheet references.

## Route Surface

- `/drawings` - list drawings.
- `/drawings/new` - create blank drawings.
- `/drawings/[id]` - interactive drawing workspace.
- `/drawings/[id]/pdf` - server-generated PDF using Playwright.
- `/drawings/[id]/print` - print-focused HTML preview.

## Data Model

Prisma stores drawings in:

- `Drawing`
  - `id`
  - `drawingKey`
  - `title`
  - `status`
  - `modelJson`
  - timestamps
- `DrawingValidationIssue`
  - still present for compatibility, but drawing validation is not exposed in
    the current canvas workflow.

`Drawing.modelJson` is parsed by `data/schema.ts` as a v2 drawing package:

- `version: 2`
- `titleBlock`
  - shared drawing-package title block fields.
- `assets[]`
  - optional package-level asset registry records with `id`, `tag`, `type`,
    `title`, symbol/version references, and generated metadata.
  - old drawings without explicit assets are reconciled from placements.
  - each physical asset must have a unique tag across the drawing package;
    repeated sheet occurrences share the same `assetId` instead of creating a
    second asset with the same tag.
- `sheets[]`
  - ordered sheets with `id`, `name`, optional `description`, and A3 landscape
    `page` dimensions.
  - optional `kind`, currently `drawing` or `section_title`.
  - isolated `placements`, `connections`, and `annotations`.
  - legacy saved `panel_layout` sheets are normalized as regular drawing sheets
    on parse so old records do not crash the canvas.
  - sheet number is derived from array order and rendered as `SHEET X OF N`.

Version 1 single-sheet drawings are still accepted by `parseDrawingModelJson`.
They are migrated in memory into a one-sheet v2 package and are written back as
v2 on save.

Each sheet stores:

- `placements`
  - `assetId` identifying the physical asset represented by the placement.
  - optional `containerAssetId` identifying the physical panel/enclosure that
    contains the placement.
  - symbol/version reference.
  - role: `device`, `cable_assembly`, `terminal_block`, `enclosure`, or
    `other`.
  - tag as the visible engineering identifier.
  - position, rotation, scale.
  - optional generated `enclosure` geometry for CAD-style panel boxes.
  - optional generated `terminalBlock` metadata for modular terminal strips.
  - optional `layoutKind`
    - `backplane` for generated programmable backplanes.
    - `layout_helper` for physical layout occurrences on a backplane, including
      DIN rails and associated panel assets placed for physical arrangement.
  - optional `layoutParentId` linking a layout helper to a backplane placement.
  - optional `layoutDimensions` storing physical `lengthMm` and `widthMm`.
  - optional `layoutScale` for backplanes. V1 defaults to automatic standard
    scale selection.
  - optional `layoutPosition` storing child placement coordinates in physical
    millimetres relative to the parent backplane.
  - dimension helpers may store independent witness coordinates, label position,
    and optional edge attachments to a backplane or another layout placement.
  - optional label/title positions.
- `connections`
  - `from` and `to` endpoint anchors.
  - optional `wireId`.
  - optional `cablePlacementId`.
  - optional `conductorKey`.
  - optional orthogonal route and label position.
- `annotations`
  - note/callout/title records.
  - note title and body text.
  - optional size and leader target.

## Module Structure

- `api/actions.ts`
  - server actions for create, save, approve, and delete.
- `api/asset-contracts.ts`
  - public asset-safe contracts and helpers used by adjacent features such as
    `drawing_asset_manager`.
- `data/schema.ts`
  - Zod schemas and core drawing model types.
- `data/queries.ts`
  - list/get drawing reads.
- `data/mutations.ts`
  - create, save, approve, and delete writes.
- `logic/commands/drawing-model-commands.ts`
  - pure sheet canvas mutation helpers used by UI state.
- `logic/commands/drawing-sheet-commands.ts`
  - drawing package sheet add, duplicate, rename, reorder, delete, and adapter
    helpers.
- `logic/services/connection-route-geometry.ts`
  - route generation and route point manipulation.
- `logic/services/connection-route-renderer.ts`
  - route SVG path, labels, route handles, and route label helpers.
- `logic/services/drawing-annotations.ts`
  - note sizing, leader geometry, clamping, and default note creation.
- `logic/services/drawing-connections.ts`
  - endpoint labels, cable defaults, duplicate prevention, connection creation.
- `logic/services/drawing-connection-groups.ts`
  - grouped connection sections for the right panel.
- `logic/services/drawing-identification.ts`
  - plant tag, cable ID, wire ID, and schedule-ready helpers.
- `logic/services/drawing-svg-renderer.ts`
  - deterministic sheet SVG renderer used by canvas, print, and PDF.
- `logic/services/drawing-generated-symbols.ts`
  - placement-aware adapter for generated symbols such as terminal strips.
- `logic/services/drawing-backplane-layouts.ts`
  - generated Backplane symbol, backplane creation, layout assignment, physical
    helper sizing, and backplane rendering helpers.
- `logic/services/drawing-backplane-scale.ts`
  - physical millimetre to sheet coordinate conversion, automatic standard
    scale selection, and layout-helper display projection.
- `logic/services/symbol-library-context.ts`
  - context-aware Symbol Library grouping, including Panel Layout helpers such
    as Backplane and DIN rail.
- `logic/services/drawing-pdf-export.ts`
  - print/PDF HTML shell.
- `logic/services/placement-title-labels.ts`
  - placement tag/title label positions.
- `logic/services/viewport-transform.ts`
  - fit, zoom, and zoom formatting math.
- `ui/components/drawing-canvas-shell.tsx`
  - top-level client state and composition.
- `ui/components/svg-drawing-surface.tsx`
  - active-sheet viewport, active-sheet overlay orchestration, and sheet
    management controls.
- `ui/components/package-preview-surface.tsx`
  - read-only package review surface that lazily renders all sheet SVGs without
    editing overlays.
- `ui/components/sheet-loader-dialog.tsx`
  - table-based sheet navigation for loading one sheet into the edit workspace.
- `ui/canvas/*`
  - focused overlay components and canvas hooks.

Adjacent drawing features:

- `src/features/drawing_panel_asset_placement`
  - builds the Associated Panel Assets work queue for a selected/visible panel
    and backplane.
  - places existing panel assets onto a backplane as layout occurrences while
    reusing the original `assetId`.
- `src/features/drawing_asset_manager`
  - drawing-level asset review and repair UI. Asset-backed layout occurrences
    count as sheet associations; non-asset layout helpers such as Backplane and
    DIN rail are intentionally hidden.
- `src/features/drawing_terminal_blocks`
  - generated modular terminal strip configuration and rendering for wiring
    diagrams and associated panel asset layout occurrences.
- `src/features/drawing_panel_wiring`
  - owns the canonical, package-level panel connectivity graph used by future
    Detailed Panel Drawings.
  - normalizes physical assets, drawing occurrences, logical terminals, terminal
    sides, and existing field terminations without duplicating source records.
  - exposes agent-safe context and terminal-mapping commands through typed public
    contracts; it does not import drawing-canvas internals.

## Detailed Panel Connectivity Foundation

- Detailed panel sheets remain normal drawing-package sheets and may carry an
  optional `panelDrawingContext` that references an existing enclosure `assetId`.
- The Add Sheet dialog can create a Detailed Panel Drawing by referencing an
  existing panel/junction box or explicitly creating one unplaced package asset.
  Sheet creation and context assignment are one model-history commit.
- A loaded Detailed Panel Drawing replaces the field symbol library with a panel
  context summary and hides field connection authoring. The right sidebar can
  relink the sheet to another compatible package panel without changing assets.
- Sheet Loader and Package Preview classify context-bearing sheets as
  `Detailed Panel`. Asset Manager includes the context as a sheet association
  and prevents deletion of the referenced panel.
- Optional package `panelWiring` data owns canonical internal wires, terminal
  mapping overrides, bridges, and shield/earth bonds. It is not generated merely
  by opening or saving an existing drawing.
- Internal wire identity is package-level. Sheet-local connection routes may link
  to that identity through `panelConnectionId` while retaining independent route
  geometry.
- Existing field connections remain authoritative and immutable. The panel graph
  derives external terminations with their original sheet, connection, endpoint,
  wire, cable, conductor, placement, and anchor provenance.
- The public canvas adapter converts `DrawingModel` plus approved/generated symbols
  into a neutral DTO. The panel domain builds indexed graph views from that DTO,
  keeping React and pointer interactions out of connectivity logic.
- Generated terminal anchors such as `T1_TOP` and `T1_BOTTOM` resolve to one
  logical terminal `T1`. Feed-through terminals expose external/internal sides;
  simple approved-symbol terminals expose a single side.

## Interaction Notes

- The rendered drawing SVG is generated by `renderDrawingToSvg`.
- Edit mode renders only the active sheet. This keeps drag, zoom, connection
  authoring, and panel-layout interaction focused on one mounted sheet.
- The Sheet Loader is the edit-mode navigation surface. It lists all sheets in
  a searchable table and loads one sheet at a time into the edit workspace.
- Loading a sheet clears transient edit state such as selections, connection
  drafts, and drag state. Viewport zoom/pan is remembered locally per sheet
  during the editing session.
- Package Preview is a separate read-only review surface. It lazily renders all
  package sheets in order without sidebars, placement handles, connection
  handles, symbol placement, or property editing.
- Print and PDF export remain package-wide server routes and are not tied to
  the interactive edit surface.
- Interactive overlays sit above only the active edit sheet and update that
  sheet's model.
- Placement label movement uses a purple handle.
- Route label movement uses a yellow handle.
- Note leader target movement uses a purple target handle.
- Note text is edited only in the right-side selected note panel.
- Active sheet changes clear selected placement, connection, and note state.
- Sheet name and description are edited in the right-side Sheet Properties
  panel.
- Symbols are placed through the Add Symbol dialog. Cables create new assets
  with the next package-wide cable tag, while compatible devices can create a
  new asset or reference an existing asset such as `TSM-101`.
- The Asset Identity panel edits the selected placement's linked asset tag. If
  the asset appears on multiple sheets, all linked placements update together.
- The Asset Manager is opened from the drawing header. It shows drawing package
  assets only, not connections, and supports creating/deleting unplaced assets.
- New asset creation and asset tag edits reject tags already used by another
  physical asset. To reuse a tag on another sheet, reference the existing asset.
- The Duplicate Sheet wizard is opened from the sheet duplicate button. It
  duplicates the active sheet only, lets the engineer rename the target sheet,
  and reviews each asset before creating or referencing it.
- When a compatible target controller or terminal asset already exists, the
  wizard can suggest referencing that asset instead of creating another one.
  This supports Tank 1 to Tank 2 workflows without bulk-copying several sheets
  at once.
- Generated panels are added from the sheet toolbar. They render as CAD-style
  enclosure boxes behind wiring and symbols, use PDP package tags by default,
  and can be referenced across sheets as the same physical panel asset.
- Programmable Backplanes are generated Symbol Library items under Panel Layout.
  They are not physical assets. Their width and height are stored as real
  physical millimetres, then rendered on the sheet at an automatic standard
  drawing scale such as `1:2` or `1:10`. Rails, ducts, and future panel layout
  helpers store physical positions relative to the Backplane and render through
  the same scale.
- Wire Tray / Duct is a generated Panel Layout helper. It behaves like DIN rail:
  it requires a backplane, does not create a physical asset, stores physical
  length/width in millimetres, autosizes to the backplane usable width on
  placement, and renders through the Backplane scale. Orthogonal trays that
  meet at an endpoint render visual 45-degree mitered corners automatically.
- Horizontal and Vertical Dimension are generated non-asset layout helpers.
  Grey witness grips can float or attach to Backplane outer/usable edges and
  layout-item edges. Attached witness feet follow the referenced placement as
  it moves or resizes. The yellow end grip changes the dimension-line offset,
  while the yellow centre grip moves the value along the dimension line.
- Dimension attachments are deliberately narrow associations, not a general CAD
  constraint system. They store a target edge and normalized position; direct
  numeric endpoint edits detach only the edited witness foot.
- The Associated Panel Assets section appears under the Symbol Library when a
  visible/selected backplane has a parent panel. It lists real assets already
  associated with that panel by `containerAssetId`.
- Associated Panel Assets are a layout work queue, not a symbol-import flow. If
  `TB-104` already belongs to `JB001`, placing it from this section creates a
  visual layout occurrence on the backplane using the existing `assetId`; it
  must not allocate `TB-105`, `TB-106`, or another new physical asset.
- An associated asset appears in the work queue until it is placed on the active
  backplane. Deleting the layout occurrence removes only the occurrence and
  returns the asset to the work queue.
- Assets that do not yet have a layout-ready symbol or supported generated
  renderer are shown disabled as `Needs layout-ready symbol`.
- Generated terminal blocks are added from the sheet toolbar. They render from
  the single-terminal module geometry, repeat horizontally, use TB package tags
  by default, and expose generated anchors such as `T1_TOP` and `T1_BOTTOM`.
- Devices and terminal assets can be assigned to a visible panel from the Add
  Symbol dialog or from the selected placement's Location / Enclosure panel.
  Cables are not contained in panels in V1.
- The drawing title is stored on the `Drawing` row; title block fields are
  shared by the drawing package.
- The canvas no longer renders inline `foreignObject` note text editors.
- Saved drawings move to `needs_review`.
- `Approve` is a manual state change and does not run application-level drawing
  checks.

## Boundaries

- The drawing canvas reads drawing-usable symbols through the symbol registry public
  interface.
- The UI does not call Prisma directly.
- Route and identification logic should remain testable without React.
- Do not reintroduce bundle routing unless the product direction changes. Cable
  assemblies are symbols.
- Do not reintroduce drawing validation UI unless the product direction changes.
  Engineering checks happen outside the application for now.

## Tests

Focused tests:

```powershell
npm run test -- src/features/drawing_panel_asset_placement/tests/panel-associated-assets.test.ts
npm run test -- src/features/drawing_canvas/tests/drawing_canvas.test.ts src/features/drawing_canvas/tests/drawing-model-commands.test.ts src/features/drawing_canvas/tests/drawing-sheet-commands.test.ts
npm run test:e2e -- tests/e2e/drawing-canvas.spec.ts --reporter=line
```

Full verification:

```powershell
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'; npm run build
npm run test:e2e -- --reporter=line
```

## Next Stage Notes

Recommended next work should build on the completed sheet model instead of
changing the canvas foundation:

- Cable schedule page from `buildCableScheduleRows`.
- Termination schedule page from `buildConnectionScheduleRows`.
- Standard templates that capture specialist engineering knowledge.
- Additional symbol imports for terminal blocks, glands, panels, and standard
  accessories.

## Restart Handoff - Drawing Canvas Branch

As of the latest restart point:

- The active drawing system is using normal drawing sheets for panel layouts,
  not a separate `panel_layout` sheet mode.
- `JB001` has existing terminal block assets assigned from wiring sheets. The
  correct panel-layout workflow is to place those existing assets from
  Associated Panel Assets onto the backplane, not create new terminal assets.
- The current associated asset implementation is V1:
  - one asset can be placed once per backplane.
  - deleting a layout occurrence returns that asset to the sidebar work queue.
  - generated terminal strip numbers remain visible in layout rendering.
  - non-asset helpers are hidden from Asset Manager.
- Before starting wire trays, open these files:
  - `src/features/drawing_canvas/README.md`
  - `src/features/drawing_panel_asset_placement/logic/services/panel-associated-assets.ts`
  - `src/features/drawing_panel_asset_placement/ui/components/panel-associated-assets-section.tsx`
  - `src/features/drawing_canvas/logic/services/drawing-backplane-layouts.ts`
  - `src/features/drawing_canvas/logic/services/drawing-backplane-scale.ts`
  - `src/features/drawing_canvas/ui/components/drawing-canvas-shell.tsx`
- Suggested next implementation target:
  - continue panel layout work by adding more generated helpers or layout-ready
    approved symbols for wire duct accessories, glands, wire tray tees, and
    panel labels.

## Branch Baseline

- Branch: `codex/detailed-panel-drawings`.
- Base commit: `228f822` (`Complete drawing canvas milestone`).
- Recovery source: local branch `codex/mixed-work-safety-20260710`.
- Included domains: Drawing Canvas, Drawing Asset Manager, Drawing Sheet
  Templates, Detailed Panel Wiring, and Panel Asset Placement.
- Excluded domains: BOM Creator and Networking routes, persistence, UI, and
  symbol-registry changes.
- Verification: 22 focused test files / 161 tests passed, lint passed, the
  production build passed, and `tests/e2e/drawing-panel-sheet.spec.ts` passed.
