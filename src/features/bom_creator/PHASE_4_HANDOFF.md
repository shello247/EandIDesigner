# BOM Creator Phase 4 Handoff

Date: 2026-07-15 (America/Port_of_Spain)

## Objective

Keep symbol mini BOM editing and live drawing BOM generation responsive at
2,500 physical assets without changing quantity calculations, warning content,
ordering, or one-count-per-asset behavior.

## Delivered Architecture

- `/bom` uses lean drawing options and parses only the selected drawing model.
- Referenced symbol identities are selected by ID with `symbolId` and
  `displayName` only. Generation templates use one header query and one line
  query in parallel, followed by one unique-item query.
- The generated route has a fixed maximum of six database reads: drawing
  options, selected drawing source, symbol identities, template headers,
  template lines, and line items. Query count does not depend on assets or lines.
- Existing `getSymbolBomTemplate()`, `listSymbolBomTemplatesForSymbols()`, and
  `generateDrawingBom(): GeneratedDrawingBom` contracts remain available.
- Generation creates placement-to-asset and asset-to-connection indexes once.
  Duplicate connection IDs and connections touching an asset through several
  endpoints count once, preserving the previous Set-based semantics.
- `per_connection` and `per_conductor_termination` use the precomputed unique
  count. The legacy placement/connection quantity context remains supported.
- Consolidated source tags use an internal Set while preserving first-seen tag
  order. Assembly, consolidated, and warning ordering are unchanged.
- `/bom` defaults to Consolidated and uses URL-controlled `view`, `page`, and
  `pageSize`. It renders one server-selected page: 50 consolidated lines, 25
  assemblies, or 50 warning details. View maximums are 100, 50, and 100.
- Warning presentation is bounded to six code summaries plus a paginated Review
  view. Consolidated rows show eight source tags and the complete source count.
- Symbol pages initially execute zero BOM reads. Opening the BOM tab dynamically
  loads the editor and a lean template. Add/Change opens a submitted 25-row item
  search; archived existing selections remain visible but are not offered anew.
- Mini BOM save validation now selects only submitted item IDs in one query.

## Generation Measurements

The fixture uses two placements, two connections, and five template lines per
physical asset. Each size was warmed once and measured five times.

| Assets | Before median | After median | Reduction | After runs (ms) |
| ---: | ---: | ---: | ---: | --- |
| 50 | 1.75 ms | 2.17 ms | within small-fixture noise | 1.92, 2.09, 2.17, 2.23, 2.43 |
| 500 | 105.48 ms | 16.57 ms | 84.3% | 15.57, 16.46, 16.57, 18.25, 20.38 |
| 2,500 | 2,028.05 ms | 92.02 ms | 95.5% | 73.08, 88.00, 92.02, 97.32, 108.18 |

The optimized 2,500-asset result contained 2,500 assemblies and 12,500 lines.
The full 4,697,821-byte domain result remains server-side.

## Browser Measurements

An isolated 300-asset database fixture produced 600 warnings and five
consolidated purchasing lines. Five production route requests measured 146.06,
87.64, 92.45, 70.23, and 85.26 ms. Every selected Consolidated response was
31,831 bytes; the unselected `/bom` response was 16,515 bytes.

Compared with the previous 4.09 MB full-result baseline, the selected response
was reduced by approximately 99.2%. Browser coverage confirmed five rendered
consolidated rows, 25 assemblies per page, 50 warnings per page, no inactive
view DOM, bounded source previews, and working URL history.

## Verification

- `npm run lint`: passed with zero warnings.
- `npm run test`: 22 files and 163 tests passed.
- `$env:DATABASE_URL='file:./dev.db'; npm run build`: passed TypeScript and the
  production Next.js build.
- `npm run benchmark:bom`: passed the local 400 ms large-fixture gate.
- Five BOM Playwright specifications: 12 tests passed, including the 300-asset
  selected-view and payload test.

## Invariants And Remaining Limits

- Physical assets remain unique by `assetId`; layout helpers remain excluded.
- Quantity-rule definitions and generated warning objects/messages are unchanged.
- Generated BOMs remain live, pure, and unsaved. No cache was introduced.
- SQLite still loads and parses the selected `Drawing.modelJson` in full, and the
  complete generated result exists in server memory before presentation slicing.
- Object storage, streaming, workers, saved snapshots, export, cable lengths,
  cursor pagination, and Drawing Canvas optimization remain future work.
- Phase 1-3 and unrelated Drawing/Networking working-tree changes were preserved.
