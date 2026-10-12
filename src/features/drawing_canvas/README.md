# Drawing Canvas

`drawing_canvas` is the model-driven engineering drawing workspace. It is the
current primary application module.

The controlled-pilot architecture, manual scripts, performance budgets,
recovery mode, and rollback checklist are documented in
[`docs/DETAILED_PANEL_RELEASE.md`](../../../docs/DETAILED_PANEL_RELEASE.md).

The canvas renders A3 landscape wiring sheets from registry symbols
and a structured `DrawingModel` package. It is intentionally not a freeform
SVG/vector editor.

## Current Status

### Manual panel labels

Panel Layout labels resolve Compact (2.0 sheet-mm, regular) by default, including
legacy drawings without new saved preferences. Standard is 2.5 and Large 3.0.
The existing Label card provides visibility, preset/manual position, unit-aware
sheet X/Y, orientation and optional straight leaders. Reset changes position only.
No automatic arrangement, tag fitting or engineering-identity edits occur.

The pure drawing-layout-labels service owns style, rotated text bounds, leader
geometry and display-to-storage translation. Canvas, preview and export use the
same output. PanelLayoutLabelOverlay holds a local rAF preview and commits once
on release; Escape/cancel discard it. Ordinary title/wire-label paths are separate.
Leaders are visual annotations, off by default, not connections. Existing
overlaps remain for manual review. See PLAN-013 and drawing-panel-labels.spec.ts.

### Compact Drawing Settings

Drawing Settings uses the shared compact dialog with General and Printed Title
Block tabs. One local draft survives tab changes and asynchronous project loads;
Apply updates the drawing draft, and the main Save persists it. Title Sheet editing
still shares the same package information without a second data store.

Use project details previews client/project replacements for confirmation.
Missing source values never erase text, and changed sources invalidate stale
reviews. All fields are validated together, with errors selecting and focusing
their tab. Dirty dismissal is guarded; background canvas shortcuts are isolated
while normal text editing inside inputs remains available.

Verification: existing settings unit suites and tests/e2e/drawing-settings-dialog.spec.ts,
included in scripts/canvas-toolbar/playwright.config.ts (guarded synthetic3121,
Chromium/Firefox, one worker). See delivery/plans/planned/PLAN-012-compact_drawing_settings.md.

### Cursor-based insertion

Spatial insertion follows choose → configure → preview → click to place. New
equipment is placed once by default. Hold **Ctrl** while clicking to place a copy
and keep the tool active; a plain click places the final copy and exits.
Use **R** to rotate supported tools and **Esc** to cancel the pending preview.
There is no repeat preference, Finish button or container dropdown.
Ctrl+wheel remains pointer-anchored on the canvas through 800% zoom; middle-button
panning remains available. Controls and positions outside the sheet never insert.

The translucent preview uses the committed geometry, including physical backplane
scale, fitted backplanes, full-span helpers and dimension offsets. New placements
use the container under the pointer, never a nearest-neighbour or free-space search.
Overlapping containers require an unambiguous pointer position or selecting the
intended container before starting the tool. References retain ownership. Invalid
positions show a reason instead of silently moving the object elsewhere.

Only an accepted click creates records or consumes a tag. Package-wide numbering
still reuses gaps and reserves unplaced assets' tags. References keep their existing
identity and do not add physical BOM quantity. Each accepted insertion is one undo
step; redo restores the same identities. Undo/redo, sheet changes and conflicting
tools cancel the pending preview. Previews are never saved, exported or dirty state.

Implementation: `data/placement-schema.ts` validates commit contracts;
`logic/services/drawing-placement.ts` resolves pure geometry and detached commands;
`ui/canvas/hooks/usePlacementSession.ts` owns transient sessions;
`ui/canvas/PlacementSessionOverlay.tsx` handles cached artwork and animation-frame
pointer updates; the memoized `PlacementInstructions.tsx` isolates static guidance.
Ctrl continuation is checked against each accepted click, not saved session state.
Existing insertion commands retain explicit automatic-position
defaults for non-interactive callers. No new storage schema or endpoints are used.

This is deliberate placement, not DIN-rail mounting-point snapping, manufacturer
clearance checking or engineering approval.

The current sheet milestone is complete enough to pause and move to the next
application stage.

Supported now:

- Drawing list, creation, deletion, save, and manual approval. The list uses
  deterministic 25-row server pages and parses drawing documents only for the
  visible page; the separate BOM drawing-option query is intentionally
  unchanged.
- Approved symbol library panel.
- Add Symbol dialog with package-wide tag allocation and existing-asset
  references for devices.
- Symbol placement, drag, resize, delete, scale, rotation, and asset tag
  editing.
- Placement tag/title labels for every draggable symbol type.
- Purple placement label handle that moves the tag/title pair together.
- Active-sheet edit workspace with Fit, 100 percent, zoom in/out, Ctrl+wheel
  zoom, and Sheet Loader navigation for switching sheets.
- Session-only horizontal and vertical drawing guides. Engineers can drag from
  the rulers after enabling guides from the sheet toolbar, then snap placement
  edges and centres while moving equipment. Guides are hidden by default,
  retained per sheet until browser refresh, and deliberately excluded from
  drawing data, history, print, PDF, and Package Preview.
- Ordered drawing-package sections derived from Section Title Page boundaries.
  Section numbers are sequential package-order values and cannot be duplicated.
- Read-only Package Preview mode for reviewing all sheets in order without
  mounting edit overlays or sidebars.
- Anchor hover data.
- Click-click connection authoring between anchors with a live orthogonal
  preview. Blank-canvas clicks pin optional route bends; Backspace removes the
  latest bend and Escape cancels the runtime-only draft.
- Grouped connection panel by transition, for example `TT-101 <-> C-101`.
- Wire IDs, conductor keys, cable placement references, and connection labels.
- Manual orthogonal route editing with route points, route-point deletion,
  screen-space alignment snapping and guides, draggable horizontal/vertical
  segments, route label yellow handles, and route reset. Shift constrains point
  movement to one axis and Alt temporarily bypasses snapping. Route points are
  drawing controls and remain separate from symbol terminal anchors.
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
- Generated panel/enclosure placements, including package-wide panel asset
  references such as `PDP-101`.
- Explicit panel containment for devices and terminal assets shown inside a
  visible enclosure on a sheet.
- Asset-backed Terminal Block Groups such as `TB-101`, with package-wide asset
  identity, an engineer-selected count, fixed `1...N` numbering, and generated
  top/internal and bottom/external terminal anchors.
- Programmable Backplanes for panel-layout work on normal drawing sheets. A
  backplane is a generated Symbol Library item under Panel Layout, not a
  physical asset.
- Scaled physical panel layouts: backplanes store real millimetre dimensions and
  render at the largest supported automatic drawing scale that fits the sheet,
  including intermediate `1:3` and `1:4` scales that avoid excessive whitespace.
  Dimension changes recenter the result in its panel, and `Fit panel` can
  recenter an existing layout without changing its physical dimensions.
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
- `/drawings/new?projectId=<active-project-id>` - create blank drawings within an active Project. Missing or unavailable project context redirects to Projects; creation rejects unassigned drawings.
- `/drawings/[id]` - interactive drawing workspace.
- `/drawings/[id]/pdf` - server-generated PDF using Playwright.
- `/drawings/[id]/print` - print-focused HTML preview.
- `/projects` - paginated organizational Project register.
- `/projects/[id]` - Project identity, lifecycle, and linked drawing summaries.

## Data Model

Prisma stores drawings in:

- `Drawing`
  - `id`
  - `drawingKey`
    - immutable server-generated compatibility identifier; not user-managed.
  - `title`
  - optional `description`
  - optional `projectId` relation to `Project`
  - `status`
  - `modelJson`
  - timestamps
- `Project`
  - organizational name, optional case-insensitively unique number, client,
    description, and active/archived lifecycle.
  - drawing membership is independent from printable title-block fields.
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
  - optional `kind`: `drawing`, `title_sheet` (package cover), or `section_title` (section divider).
  - isolated `placements`, `connections`, and `annotations`.
  - legacy saved `panel_layout` sheets are normalized as regular drawing sheets
    on parse so old records do not crash the canvas.
  - sheet number is derived from array order and rendered as `SHEET X OF N`.

### Drawing Package Sections

- Newly created packages begin with a **Title Sheet**, edited using **Edit Title Sheet**.
  The cover reads the drawing title and shared `titleBlock` fields; it stores no duplicate
  project, client, revision, date or authorship information. Apply changes the local
  draft, then Save persists it using the existing drawing revision check.
- Existing packages are unchanged on read. **Edit active sheet → Convert to Title Sheet**
  is available only for an empty ordinary first sheet (no description, panel context,
  section details, annotations, connections or placements), with explicit confirmation.
- A package cover is first and unique, cannot be moved into a section, and does not
  increment section numbers. Canvas, package preview, print and PDF use the same cover
  renderer. The `createDefaultDrawingModel` utility retains its plain-sheet default for
  programmatic authoring; the user-facing creation mutation requests `withTitleSheet`.
- Saved `title_sheet` packages require this version of the reader; no database migration
  or automatic rewrite of existing drawings is performed.

- A Section Title Page starts a section. Every following sheet belongs to that
  section until the next Section Title Page.
- Sheets before the first Section Title Page appear under **Package Information**
  (internal `front_matter` identity retained). This group is not a numbered section;
  sheet/page numbering still applies. Its package Title Sheet describes the whole package.
- Package Information opens expanded. Leading working sheets show **Needs section**
  and stay in their original positions until explicitly moved to a named section.
  Opening the loader does not normalize, move, renumber or save those sheets.
- **Add Section** creates a named section and its title page at the package end;
  section numbering starts at 1. **Add Sheet** requires an existing section or a
  new section title. The active section is preselected when available; otherwise
  the engineer must choose. Creating a new section and its first working sheet is
  one local commit/undo action, including Detailed Panel reference/create flows.
- Interactive sheet destinations are validated against the current model by
  `drawing-sheet-destination.ts`. Cancel/error discards intermediate changes;
  no blank section is left behind. New working sheets append inside the chosen
  section; Package Information is not an interactive destination. Non-interactive
  generator commands retain their existing insertion contracts.
- Section identity is the title-page sheet ID. Section number and member-sheet
  membership are derived from `sheets[]` order and are not duplicated in new
  persisted metadata.
- Legacy `sectionTitlePage.sectionNumber` values still parse but do not control
  ordering or normal rendering.
- Moving a section moves its title page and complete contiguous member block.
  Normal sheet move commands remain inside the current section; cross-section
  movement is an explicit command.
- Removing a section divider preserves its member sheets and merges them into
  the preceding section or Package Information. Removing the first divider
  therefore marks its former working members Needs section, with an explicit warning.

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
- `logic/services/guided-connection-routing.ts`
  - runtime waypoint snapping and the shared preview/commit geometry for
    ordinary guided connections. A direct connection remains automatic;
    one or more pinned bends produces persisted manual route geometry.
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
- `logic/services/drawing-guides.ts`
  - pure ruler tick generation and screen-space placement-guide snapping with
    acquisition/release hysteresis.
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
- `ui/components/drawing-guide-rulers.tsx` and
  `ui/canvas/DrawingGuidesOverlay.tsx`
  - interactive-only ruler and guide surfaces. They are never passed to the
    shared SVG renderer used for deliverables.
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
- Its Panel Engineering Workbench focuses on selecting existing physical
  equipment for the sheet and exposes direct Equipment, External Terminations,
  Terminal Map, Internal Wires, and Connection Patterns views. Physical
  equipment is defined by the panel layout and referenced here; the Detailed
  Panel workspace does not create new panel devices.
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
- A represented asset on a Detailed Panel Drawing defaults to external
  connections and renders resolved field terminations as straight, non-editable
  teal stubs at canonical external/BOTTOM or single-sided anchors. Connection
  Display can instead show internal/TOP wires, both canonical kinds, or sheet
  routes only. The linked schedule follows the same occurrence setting. The
  display is derived only; it does not add or duplicate a sheet connection and
  is shared by canvas, Package Preview, print, and PDF.
- A Detailed Panel Drawing exposes a Panel Engineering Workbench derived from the memoized
  connectivity graph. It lists associated physical assets and field terminations
  as available, represented, missing, conflicting, or unsupported records.
- Adding equipment from the Panel Engineering Workbench reuses the existing physical `assetId` and
  uses a resolved wiring occurrence when available, otherwise a resolved
  asset-backed panel-layout occurrence. Layout sources create a schematic-scale
  representation without backplane layout fields. Placement never creates a
  package asset, allocates a new tag, or copies source connections.
- New Detailed Panel equipment is positioned from the usable sheet center
  outward. The Equipment view can explicitly center the represented equipment
  group without moving notes or reference helpers.
- Removing a Detailed Panel occurrence returns its asset to the work queue.
  Removal is blocked when sheet-local wiring references that occurrence.
- The Detailed Panel workbench is distinct from the Backplane Associated Panel
  Assets workflow: the former supports electrical-detail drawings; the latter
  supports physical arrangement at real millimetre scale.
- The public canvas adapter converts `DrawingModel` plus approved/generated symbols
  into a neutral DTO. The panel domain builds indexed graph views from that DTO,
  keeping React and pointer interactions out of connectivity logic.
- Generated terminal anchors such as `T1_TOP` and `T1_BOTTOM` resolve to one
  logical terminal `T1`. Feed-through terminals expose external/internal sides;
  simple approved-symbol terminals expose a single side.
- The Panel Engineering Workbench also provides a terminal-level map. Automatic field-side
  mappings are derived from source connections, while engineer corrections are
  stored as canonical `{assetId, terminalKey, side}` overrides. Resetting an
  override restores automatic resolution without changing the source connection.
- Terminal-side occupancy includes field terminations and existing panel wiring
  records across every sheet occurrence of the same physical asset. Any resolved
  internal, external, or single side may be selected for a field record when it
  is free; occupied, out-of-panel, unresolved, and conflicting targets are
  rejected. Rendering follows the selected anchor while schedules retain the
  canonical field-record identity.
- Wire mode creates canonical internal wires by selecting terminals directly on
  the sheet. It uses the same validation, ID allocation, orthogonal routing,
  history, and renderer as the workbench records.

## Interaction Notes

- The rendered drawing SVG is generated by `renderDrawingToSvg`.
- Managed equipment occurrences use one `connectionDisplayMode`: `sheet_only`,
  `internal_connected`, `external_connected`, or `all_connected`. Normal sheet
  routes remain authoritative while selected off-sheet canonical rows render as
  non-interactive terminal stubs. A mode change updates the linked Connected Wire
  Schedule and every pagination continuation in one history entry. Legacy
  Detailed Panel occurrences default to external; ordinary occurrences default
  to sheet routes.
- Edit mode renders only the active sheet. This keeps drag, zoom, connection
  authoring, and panel-layout interaction focused on one mounted sheet.
- The Sheet Loader is the edit-mode navigation surface. It groups sheets by
  Package Information and sequential sections, supports explicit section reordering
  and cross-section sheet movement, and loads one sheet at a time into the edit
  workspace.
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
- Canvas copy/paste is layout-only. It can copy eligible placements and
  annotations, but it never copies connections, route geometry, cable conductor
  assignments, patterns, Wire IDs, or occupancy.
- Complete circuit drawings are created through explicit sheet, asset, cable,
  and connection commands. The canvas does not infer new wiring from an existing
  sheet or selection.
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
  When selected, the tray also exposes two cyan end handles. Dragging either
  end changes only the longitudinal length, preserves the registered width,
  and keeps the opposite end fixed through orthogonal rotation.
- Standard TH35 DIN rail is rendered as cut-to-length stock on drawing sheets.
  Its rail body follows the stored physical length while complete 18 x 9 mm
  mounting slots remain at a fixed 45 mm pitch and are centred between the cut
  ends. Resizing adds or removes slots instead of stretching the approved
  Registry artwork; Registry previews continue to show the authored source SVG.
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
- Terminal Strip is available under Panel Layout. It opens the shared Structured
  Terminal Strip Builder, creates one managed assembly on the selected
  panel-associated backplane, and allocates the next package-wide TB tag.
- Structured strips contain ordered, version-pinned electrical members,
  brackets, and accessories. Permanent member tokens namespace terminals, and
  composition edits update every occurrence while preserving canonical wiring.
- Selected structured strips expose a dedicated **Reuse terminal strip** action.
  Copy as new creates an independently editable TB asset with no wiring;
  representation placement shares the existing asset and occupancy and permits
  mounted reuse only in the same unambiguous physical mount. Generic paste is
  blocked for structured strips so the engineer must choose the intended
  identity lifecycle explicitly.
- Panel-layout sheets also expose **Add → Copy Existing Terminal Strip**. This
  destination-first entry point lists each valid structured strip once, fixes
  the active sheet as the destination, preselects its sole backplane when
  available, and invokes the same copy-as-new command with no wiring or
  occupancy copied.
- Legacy count-based terminal groups remain readable and deletable, but have no
  creation, editing, or reference entry point.
- Equipment panel membership is established through the Panel Layout workflow:
  layout items inherit the panel of their parent backplane. Generic add dialogs
  and drawing Properties do not offer a Location / Enclosure assignment control.
  Detailed Panel occurrences retain their existing panel association and show
  the parent panel read-only in Panel Component. Existing saved containment and
  wiring records remain unchanged; this does not introduce a new sheet kind.
  Cables are not contained in panels in V1.
- The drawing title is stored on the `Drawing` row; title block fields are
  shared by the drawing package.
- The canvas no longer renders inline `foreignObject` note text editors.
- Saved drawings move to `needs_review`.
- `Approve` submits the current package once and runs server-side Detailed Panel
  connectivity QC. Blocking panel findings preserve `needs_review`; warnings do
  not block. Packages without Detailed Panel contexts retain manual approval.
- The canvas toolbar has no standalone **Panel Review** action; a dedicated
  approval workflow is deferred. A blocked approval opens the saved package in
  the read-only Panel Analysis workspace. Findings are derived, not persisted,
  and the drawing editor no longer mounts review or repair dialogs.

## Boundaries

- The drawing canvas reads drawing-usable symbols through the symbol registry public
  interface.
- Initial editor, save, preview, print, PDF, and panel-report rendering resolve
  only the model's exact pinned symbol-version dependency closure. The Symbol
  Library and Asset Manager browse lightweight latest-approved summaries;
  selecting a new symbol loads its complete immutable record and allowed
  component closure on demand. Failed loads remain retryable and never insert a
  partial asset.
- Loaded catalogue records that are not referenced by the drawing model stay
  outside the engineering preparation key. Browsing the library therefore does
  not rebuild an unchanged connectivity graph.
- The UI does not call Prisma directly.
- Route and identification logic should remain testable without React.
- Do not reintroduce bundle routing unless the product direction changes. Cable
  assemblies are symbols.
- Keep package-wide engineering findings in Panel Analysis rather than adding
  competing validation cards or dialogs to the drawing editor.

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

## Panel Analysis reports

Panel Analysis derives read-only terminal, internal-wire, panel-asset, and BOM
tables from the latest saved structured package graph. Its report sections share
the existing deterministic projections and permit package or panel filtering.

CSV and XLSX downloads rebuild from the saved model. Existing print/PDF URLs stay
drawing-only unless explicit composition parameters request schedules-only or
drawing-plus-schedules output. Draft schedule pages are marked not for issue.
Issued downloads require an approved saved drawing and clean package-wide panel
QC. Unsaved canvas revisions must be saved before any download.

## Schematic Panel Connection References

For physical layouts, **Panel / enclosure → Place existing panel** reuses a
registered panel's identity, tag and title without requiring a backplane. Place
the enclosure first, then add its backplane. The same panel cannot be physically
placed twice on one sheet. **Create new panel** still creates a new identity.

On ordinary connection drawings, **Panel / enclosure → Add schematic reference**
creates a compact schematic frame linked to one authoritative physical
backplane. It reuses the panel asset identity but deliberately ignores the
enclosure and backplane dimensions, scale, rails, trays, and physical equipment
layout. Physical panel-layout occurrences remain the only source of physical
mount and scale information.

Associated Panel Assets placed inside a connection reference are drawing-space
representations of their real assets. They share terminal identities and
occupancy, including structured terminal-strip member tokens, while carrying no
physical layout dimensions or positions. The first representation fills most of
the inner frame; later representations are placed without resizing existing
ones. **Fit contents** is the explicit action that uniformly refits the group.

## Next Stage Notes

Detailed Panel Drawings now use a strict, capability-driven Panel Component
Library. Approved symbols opt in through `metadata.panelWiring`, and component
placement either creates one globally tagged package asset or references an exact
compatible asset already associated with the active panel. Dedicated
representation commands preserve asset identities, while clipboard guards
prevent duplicate same-sheet or cross-panel representations.

Detailed Panel Wire mode creates canonical package-level internal wires and
sheet-local orthogonal route occurrences. Each route references its physical wire
through `panelConnectionId`, so route-only removal preserves terminal occupancy
and physical-wire identity. Internal and single terminal sides are eligible,
external field sides remain protected, and Package Preview, print, and PDF use the
same dedicated internal-wire renderer.

Detailed Panel Pattern mode builds structured jumpers, bridge bars, daisy chains,
distribution groups, fused distribution, shielding, PE, and signal-ground bonds.
The guided canvas workflow resolves ordered canonical terminal references, shows
generated wire IDs before commit, and writes the pattern, owned wires, route
occurrences, generated references, and legend in one history operation. Pattern
routes are visually distinct without relying on color alone. Removing one route
representation preserves physical connectivity; deleting the physical pattern
cascades only its owned wires and route occurrences.

Recommended next work should build on the completed sheet model instead of
changing the canvas foundation:

- Cable schedule page from `buildCableScheduleRows`.
- Termination schedule page from `buildConnectionScheduleRows`.
- Presentation-only layout aids that never recreate canonical wiring.
- Additional symbol imports for terminal blocks, protection devices, earth bars,
  glands, panels, and standard accessories with explicit electrical domains.

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

## Fixed canvas header and active-view toolbar

- The active sheet name and sheet count appear once above the canvas. The
  View select replaces representation tabs; title sheets retain Outline only.
- Add opens an anchored keyboard menu in the toolbar, outside the scrolling
  canvas. Arrow/Home/End navigate enabled actions; Escape dismisses and returns
  focus. Existing insertion commands, placement controls and safeguards remain.
- Schematic Preview uses the public embedded presentation contract to portal
  its own controls into the header. Authoring controls are absent in preview;
  read-only/source/review qualifications remain. The standalone demo is unchanged.
- Outline stays mounted and restores its scroll position across view changes.
  Outline zoom (20–800%) and preview width zoom (50–200%) remain independent.
  UI navigation does not alter the drawing model, history or save state.
- Serial Chromium/Firefox checks use synthetic SQLite on guarded port 3121 via
  scripts/canvas-toolbar/playwright.config.ts. Stop only the owned shared server
  during qualification because this worktree shares its Next build directory.

## Branch Baseline

- Branch: `codex/detailed-panel-drawings`.
- Base commit: `228f822` (`Complete drawing canvas milestone`).
- Recovery source: local branch `codex/mixed-work-safety-20260710`.
- Included domains: Drawing Canvas, Drawing Asset Manager, Drawing Sheet
  Templates, Detailed Panel Wiring, and Panel Asset Placement.
- Included adjacent domain: BOM Creator public projection API and panel
  engineering reports/exports.
- Excluded domain: Networking routes, persistence, UI, and symbol-registry
  changes.
- Verification: 54 unit files / 286 tests passed, lint and the production build
  passed, eight Detailed Panel E2E scenarios passed, and four BOM Creator E2E
  scenarios passed. Phase 10 also adds dedicated JB001 and generic-panel release
  workflow specifications.

## Phase 10 Release Hardening

- Pointer-driven placement, route, label, resize, rotation, dimension, title,
  and note gestures use transient drafts and create one model/history commit on
  pointer-up. Escape or pointer cancellation restores the start model.
- Package Preview keeps exact placeholders and mounts at most 12 full-sheet SVGs.
- Panel Engineering Workbench and Asset Manager are dynamically loaded. Large
  engineering tables use deferred search and bounded pagination.
- `PanelEngineeringSnapshot` shares one validated source and graph. QC is derived
  for saved Panel Analysis, approval, and exports; report rows share one linear
  `PanelReportIndex`.
- Saves and approval use `expectedUpdatedAt`. Conflicts preserve local work and
  offer JSON recovery download or explicit reload; no automatic merge occurs.
- `DETAILED_PANEL_DRAWINGS_ENABLED=false` makes Detailed Panel content read-only
  while retaining existing data, review, Package Preview, and exports. Server
  guards prevent client bypass and unrelated field sheets remain editable.
- Opt-in diagnostics record operation names, counts, and durations only. The
  certified large fixture runs with `npm run test:panel-perf`.
- Future agent calls are revision-bound, exact-identity, SHA-256-approved plans;
  no AI model or autonomous agent UI is included.
