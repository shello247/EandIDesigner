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
- Scrollable multi-sheet workspace with Fit, 100 percent, zoom in/out, and
  Ctrl+wheel zoom.
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
- `logic/services/drawing-pdf-export.ts`
  - print/PDF HTML shell.
- `logic/services/placement-title-labels.ts`
  - placement tag/title label positions.
- `logic/services/viewport-transform.ts`
  - fit, zoom, and zoom formatting math.
- `ui/components/drawing-canvas-shell.tsx`
  - top-level client state and composition.
- `ui/components/svg-drawing-surface.tsx`
  - scrollable multi-sheet viewport, active-sheet overlay orchestration, and
    sheet management controls.
- `ui/canvas/*`
  - focused overlay components and canvas hooks.

## Interaction Notes

- The rendered drawing SVG is generated by `renderDrawingToSvg`.
- The canvas renders all sheets vertically; inactive sheets are read-only SVG
  previews.
- The active sheet is the page nearest the viewport center or the page clicked
  by the user.
- Interactive overlays sit above only the active sheet and update that sheet's
  model.
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
  They are not physical assets. They sit inside visible panels and provide a
  structured parent surface for rails, ducts, and future panel layout helpers on
  normal drawing sheets.
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
