# Network Maps

`network_maps` owns industrial networking map packages, interactive node
editing, deterministic SVG rendering, and print/PDF export.

## Current Scope

- `/networking` lists network map packages.
- `/networking/new` creates a blank network map package.
- `/networking/[id]` provides the interactive map editor.
- `/networking/[id]/print` returns print-ready HTML.
- `/networking/[id]/pdf` returns a PDF generated from the same SVG renderer.
- The map workspace displays an approved network-device catalog with search,
  device-type filtering, managed-status filtering, and lazy SVG previews.

Approved devices can be placed, selected, moved, edited, and deleted. Link
authoring and route editing remain intentionally deferred.

## Data Model

Prisma stores packages in `NetworkMap` with a validated `modelJson` payload.
The model contains title block values, sheets, zones, network nodes, topology
links, and annotations.

Network device shapes can reuse the existing symbol registry when authoring is
introduced. Network symbols use:

- `category: "network_device"`
- network port anchors using `kind: "network_port"`
- `metadata.networkProfile` with device type and port metadata

Drawing canvas symbol reads intentionally exclude `network_device` records. New
maps do not depend on seeded symbols; newly approved devices appear after a page
refresh.

## Approved Device Library

The symbol registry owns approved-device queries and SVG asset reads. The map
feature owns client-side filtering, canonical grouping, display labels, and
collection of unique version IDs referenced by map nodes.

- `listNetworkSymbolCatalogForMapping()` returns lightweight catalog rows with
  identity, profile summaries, a normalized search index, and a preview URL. It
  never returns SVG or complete metadata.
- `listApprovedNetworkSymbolVersionsByIds()` bulk-loads only requested,
  approved network versions. Inputs are deduplicated and queried in SQLite-safe
  chunks.
- Blank maps serialize no complete symbol SVGs. Populated maps serialize one
  complete symbol per unique referenced immutable version ID.
- Print and PDF routes do not load the catalog. They bulk-load only versions
  referenced by the validated map model.
- The SVG renderer builds one symbol-reference lookup map per render instead of
  repeatedly scanning symbol arrays for every node and link.

Catalog filtering is client-side for the current 500-device ceiling. Results
are grouped in the canonical network device-type order and sorted by display
name, symbol key, and version ID. Search covers identity, device type, managed
status, port keys and labels, media, speeds, and protocol hints. Catalog items
are budgeted to at most 1 KB each, keeping the 500-item payload at or below
approximately 500 KB before transport compression.

## Device Placement And Editing

- Selecting a catalog tile loads its approved immutable version once and caches
  it by `versionId` for the editor session. Re-selecting the active tile or
  pressing Escape cancels placement.
- Placement is one-shot. A click on the active sheet is converted from rendered
  client coordinates to sheet coordinates, centered on the symbol, snapped to
  the sheet grid, and clamped to the sheet bounds. The default scale is `0.35`.
- Node IDs use `node_<UUID>`. Default tags use device-specific prefixes and the
  lowest unused three-digit number. Tags are case-insensitively unique across
  the complete map package.
- Node identity fields (`id`, `symbolId`, `versionId`, and `deviceType`) are
  immutable. The properties panel edits tag, label, IP address, VLAN, zone,
  rotation, and scale. Scale is restricted to `0.1` through `4` and rotation is
  normalized to `[0, 360)`.
- Drag previews are local to the active sheet and coalesced with animation
  frames. Drag end commits one validated model command, keeping inactive sheet
  references stable during the gesture.
- Delete and Backspace remove the selected node when the sheet overlay has
  focus. Deletion also removes every link on that sheet that references the
  node, defining the lifecycle required by future link authoring.
- Missing historical symbol versions remain visible and selectable through a
  deterministic `140 x 82` placeholder. Missing assets do not invalidate the
  stored map model and use the same placeholder in canvas, print, and PDF.
- Save validates the complete package through Zod. Reload, print, and PDF
  bulk-load only unique referenced approved versions and use the same renderer
  transforms as the editor.

Current interaction exclusions are multi-selection, marquee, clipboard,
nudge commands, resize and rotation handles, undo/redo, links, automatic
layout, live discovery, and external inventory integration.

## Verification

```powershell
npm run test -- src/features/network_maps/tests/network_maps.test.ts src/features/network_maps/tests/network-library-catalog.test.ts src/features/network_maps/tests/network-map-library-panel.test.ts src/features/network_maps/tests/network-node-commands.test.ts src/features/network_maps/tests/network-node-geometry.test.ts src/features/symbol_registry/tests/network-symbol-catalog.test.ts
npm run lint
$env:DATABASE_URL='file:./dev.db'; npm run build
npm run test:e2e -- tests/e2e/networking.spec.ts --reporter=line
```

## Branch Baseline

- Branch: `codex/networking`.
- Base commit: `228f822` (`Complete drawing canvas milestone`).
- Recovery source: local branch `codex/mixed-work-safety-20260710`.
- Included domains: Networking routes, `NetworkMap` persistence, the network map
  model/renderer/canvas, print/PDF export, and networking symbol-registry reads.
- Excluded domains: BOM Creator and Detailed Panel Drawing code and persistence.
- Device authoring and review are complete through Phase 2. The performant
  approved catalog is complete through Phase 3. Phase 4 adds placement,
  selection, movement, basic properties, deletion, and deterministic missing
  version handling; link editing remains a future phase.
- Phase 3 verification covers lightweight payloads, deterministic filtering and
  grouping, empty/no-result states, approved-only bulk reads, preview failure,
  asset caching, and refresh behavior without seed dependencies.
