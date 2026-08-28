# Symbol Registry

`symbol_registry` owns the controlled SVG symbol library used by the drawing
canvas.

Approved symbols are the only geometry source for drawing placements. Other
features should use registry public actions/services instead of writing symbol
records directly.

## Current Responsibilities

- Store symbols and symbol versions.
- Store sanitized SVG text.
- Store metadata JSON including viewBox, terminals, anchors, optional panel
  layout physical metadata, and network device profiles.
- Store source asset records for imported SVGs.
- Store engineer notes and pasted/reference images for symbols.
- Store uploaded symbol documents for later review.
- Maintain draft, needs_review, approved, and archived symbol states.
- Expose approved symbols to the drawing canvas through the public registry
  interface.

## Prisma Data

The registry owns:

- `Symbol`
- `SymbolVersion`
- `SymbolValidationIssue`
- `SymbolSourceAsset`
- `SymbolEngineerNote`
- `SymbolDocument`

Symbol validation remains part of the symbol workflow. Drawing validation was
removed from the drawing canvas workflow, but symbol validation still matters
because symbols are the controlled source of geometry, terminals, and anchors.

## Routes

- `/symbols` - registry list.
- `/symbols/new` - SVG-only import workflow.
- `/symbols/[id]` - category-specific symbol review, engineer notes, documents,
  validation, and approval.
- `/symbols/documents/[documentId]/download` - document download.

## Metadata Editing

The latest non-archived version exposes one controlled metadata draft and one
**Save changes** action. Approved metadata updates are validated and written to
the current version in place without changing its approved status or creating a
new version.

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
- Network symbols remain excluded from the E&I drawing symbol query and are
  exposed to Networking only after approval and successful metadata parsing.
- Imported network marker geometry is removed before the production SVG is
  stored; the original SVG remains available as the source asset.

## Network Review And Approval

- Network symbol details show manufacturer, model, device type, managed status,
  a structured port table, and network-port hotspots over the SVG preview.
- Network symbols do not mount panel-layout, terminal-map, or AI terminal review
  controls. Electrical categories retain those existing workflows.
- Engineers can correct network identity and port metadata on the latest
  non-archived version; saving refreshes validation issues.
- Every network device type requires at least one valid port for approval.
  Portless profiles remain valid review drafts but produce the blocking
  `NETWORK_PORT_REQUIRED` approval issue.
- Duplicate keys, missing or non-network anchors, malformed port values, and
  out-of-bounds anchors block approval.
- Approved metadata can be updated without changing approval. Archived versions
  remain immutable.
- Anchor coordinates and SVG geometry are not editable in the review workspace;
  correcting either requires re-importing the SVG as a new version.

The automated approval reference is a runtime-created managed four-port
industrial switch. It is not a seeded registry dependency.

## Network Mapping Reads

The registry exposes three network-map read paths:

- `listNetworkSymbolCatalogForMapping()` returns approved `network_device`
  catalog projections without raw SVG or complete metadata. Malformed profiles
  are excluded.
- `listApprovedNetworkSymbolVersionsByIds(versionIds)` returns complete SVG and
  metadata only for requested approved versions. Duplicate IDs are removed and
  large requests are split into SQLite-safe chunks.
- `getApprovedNetworkSymbolSvgAsset(versionId)` supports the read-only preview
  route at `/symbols/network-assets/[versionId]`.

The preview route returns sanitized `image/svg+xml` with `nosniff`, an immutable
version-ID `ETag`, and `Cache-Control: public, max-age=0, must-revalidate`.
Matching conditional requests return `304`; draft, archived, malformed, and
non-network versions return `404`.

`listNetworkSymbolsForMapping()` remains as a deprecated compatibility read.
New map, print, and PDF callers must use the catalog and referenced-version
queries so a large catalog is not serialized with complete SVG strings.

The network map editor uses the selected catalog version for one-shot placement
and caches complete approved versions by immutable `versionId` for the editor
session. The registry remains responsible only for approved catalog and asset
reads; placement, movement, selection, and node metadata stay owned by
`network_maps`.

## Tests

```powershell
npm run test -- src/features/symbol_registry/tests/symbol_registry.test.ts src/features/symbol_registry/tests/network-symbol-review.test.ts src/features/symbol_registry/tests/network-symbol-catalog.test.ts
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
