# Symbol Registry

`symbol_registry` owns the controlled SVG symbol library used by the drawing
canvas.

Saved, available symbols are the geometry source for drawing placements. Other
features should use registry public actions/services instead of writing symbol
records directly.

## Current Responsibilities

- Store symbols and symbol versions.
- Store sanitized SVG text.
- Store metadata JSON including viewBox, terminals, anchors, optional panel
  layout physical metadata, and network device profiles.
- Store source asset records for imported SVGs.
- Make complete imports and saved metadata available without validation, approval, or archive commands.
- Retain legacy status tokens for exact-version and existing-drawing compatibility.
- Expose available symbols to the drawing canvas through the public registry
  interface.

## Prisma Data

The registry owns:

- `Symbol`
- `SymbolVersion`
- `SymbolValidationIssue`
- `SymbolSourceAsset`

There is no separate validation or approval workflow. Save/import still enforce
SVG sanitization, parseable metadata, valid terminal references and component
integrity. The legacy `approved` storage token means available; it does not record
an approval decision. Incomplete imports remain drafts until corrected and saved.
Historical `SymbolValidationIssue` rows are retained, but are no longer queried,
written, displayed or used to gate saving. No bulk record migration is required.

## Routes

- `/symbols` - registry list, filtered by managed category and server-paginated
  at ten rows per page. Each row reports whether its Symbol Mini BOM links to
  Items Library records.
- `/symbols/new` - SVG-only import workflow.
- `/symbols/[id]` - Overview metadata editing and BOM only. Product notes and PDFs belong to Items.

Symbol-owned notes/PDFs and their download route are retired. The dry-run-first
`npm run db:retire-symbol-guidance` maintenance command inventories legacy storage;
apply requires the reviewed inventory file/hash, stopped runtime and a verified
recovery backup. It never copies content to Items or changes Symbol source assets.

## Metadata Editing

The latest non-archived version exposes one controlled metadata draft and one
**Save changes** action. Saving checks data integrity and makes the current
version available immediately, without an approval action or a new version.

Registry name and description are editable. SVG artwork, viewBox data, anchors,
symbol key, registry category, and Figma-authored component geometry remain
controlled. Replacing those assets requires the SVG import workflow. Archived
and historical versions remain read-only. Physical dimension changes require
confirmation because drawings pinned to the current version may consume the
updated size.

## Drawing Canvas Relationship

The drawing canvas receives lightweight latest-approved catalogue summaries
for browsing and complete exact-version records only for the drawing model's
pinned dependency closure. Selecting a new catalogue item loads that immutable
version on demand; save validation, preview, print, PDF, and panel deliverables
use the same exact-version path and never substitute the latest version for a
missing historical reference. It uses each resolved symbol's metadata to:

- render placements.
- expose anchor hover data.
- support anchor-to-anchor connection authoring.
- derive readable endpoint labels.
- derive conductor and wire ID defaults.
- normalize approved terminals for Detailed Panel Drawings. A terminal may declare
  `panelSide` as `external`, `internal`, or `single`; repeated logical keys require
  explicit unique sides, while legacy one-anchor terminals remain single-sided.
- constrain Detailed Panel connection patterns through optional per-terminal
  `electricalDomains` (`signal`, `power`, `neutral`, `shield`, `protective_earth`,
  or `signal_ground`). Missing constraints remain backward-compatible and produce
  capacity/domain warnings rather than guessed engineering behavior.
- optionally declare a terminal `electricalRole` for deterministic polarity and
  path checks. Historical versions without a role remain valid; Panel Analysis
  labels conservative label/function inference and does not rewrite those versions.
- filter and place approved panel layout symbols at configured physical
  millimetre size.
- expose symbols to Detailed Panel Drawings only through explicit
  `panelWiring` capability metadata. The capability declares the package asset
  type, default tag prefix, and optional schematic scale; valid electrical
  terminal/anchor metadata remains mandatory.

The canvas should not bypass this module to read symbol internals directly.

## Network Symbol Contract

- Network symbols use category `network_device` and must include
  `metadata.networkProfile`.
- Non-network categories cannot include a network profile.
- Network port keys and referenced network anchor keys normalize to uppercase.
- Port keys are unique and each port must reference an anchor whose kind is
  `network_port`.
- Approved network-device versions remain available to drawing and panel
  workflows through the same exact-version symbol contracts used by other
  physical equipment.
- Imported network marker geometry is removed before the production SVG is
  stored; the original SVG remains available as the source asset.

## Network Metadata Editing

- Network symbol details show manufacturer, model, device type, managed status,
  a structured port table, and network-port hotspots over the SVG preview.
- Network symbols do not mount panel-layout, terminal-map, or AI terminal review
  controls. Electrical categories retain those existing workflows.
- Engineers can correct network identity and port metadata on the latest
  non-archived version; saving makes valid metadata available directly.
- Every network device type requires at least one valid port for use in drawings.
  Portless profiles remain valid review drafts but produce the blocking
  `NETWORK_PORT_REQUIRED` save error.
- Duplicate keys, missing or non-network anchors, malformed port values, and
  out-of-bounds anchors block saving.
- Saved metadata can be updated without a review step. Historical archived versions
  remain immutable.
- Anchor coordinates and SVG geometry are not editable in the review workspace;
  correcting either requires re-importing the SVG as a new version.

The automated authoring reference is a runtime-created managed four-port
industrial switch. It is not a seeded registry dependency.

## Network Device Compatibility

`network_device`, `networkProfile`, and `network_port` describe physical
equipment and its ports. They remain part of the Symbol Registry so approved
switches and similar devices can be placed, rendered, wired, reviewed, and
reloaded in electrical drawings without losing manufacturer or port metadata.

The standalone network-map product and its map-only catalog, asset-preview, and
placement APIs have been retired. Drawing consumers continue to resolve pinned
symbol versions through the standard drawing symbol queries; they do not depend
on a separate network-map catalogue.

## Replace artwork

Overview offers **Replace artwork** when metadata is saved and the symbol is not
archived. Upload an SVG (maximum 50 KB), review the server-checked side-by-side
preview, acknowledge it, and save. This intentionally supports presentation-only
changes: fills, strokes and line weights. Geometry, labels, IDs, viewBox and other
attributes must remain unchanged. Unsupported SVG constructs are rejected.

The server appends a version with the exact saved metadata, preserving terminals,
anchors, dimensions and the symbol-level Mini BOM link. Existing drawing versions
are not rewritten. Preview tokens reject stale source data; version/source-asset
creation is atomic. Versions with Item configurations are blocked until their
configuration carry-forward is supported. Dirty metadata must be saved first.

To restore an earlier appearance, upload its matching original SVG through this
workflow to create another version. Historical versions remain available; do not
restore a whole database for an artwork-only rollback.

## Verification commands

```powershell
npm run test -- src/features/symbol_registry/tests
```

Full app verification:

```powershell
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'; npm run build
```
# Permanent Electrical Topology

Approved symbol metadata may include `electricalTopology.version = 1` with
permanent continuity groups. Group keys and logical terminal keys are canonical
identity. Terminal row order, labels, functions, and SVG coordinates are
presentation and must never be used to infer electrical continuity.

The Registry editor accepts only permanent factory-installed passive
conductors. It rejects missing terminal keys, singleton groups, duplicate or
overlapping membership, duplicate group keys, and explicitly incompatible
electrical domains. Fuses, breakers, relay contacts, and controlled paths must
remain separate until a future typed functional-topology model exists.
