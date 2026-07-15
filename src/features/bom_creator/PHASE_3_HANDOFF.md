# BOM Creator Phase 3 Handoff

Date: 2026-07-10 (America/Port_of_Spain)

## Objective

Keep the Items Library responsive and payload-bounded with thousands of records
by adding a lean paginated list query, submitted URL filters, deferred form data,
and on-demand modal chunks without changing symbol mini BOM consumers.

## Delivered Architecture

- `/bom/items` parses `q`, `category`, `manufacturer`, `page`, and `pageSize`.
  Empty values are removed, page defaults to 1, page size defaults to 50, and
  invalid values fall back within a hard 100-row maximum.
- Search uses SQLite-compatible case-insensitive substring matching across item
  key, display name, part number, manufacturer, and supplier name. Category and
  manufacturer filters are exact matches.
- `listBomItemRows()` selects only table fields, one primary-image metadata row,
  and mini BOM usage count. It runs count and requested-page queries in parallel,
  orders by display name then permanent item key, and performs one corrective
  query when an out-of-range page must be clamped.
- `listBomItemFilterOptions()` runs distinct active category and manufacturer
  queries concurrently. It does not load the heavier create/edit form options.
- `listBomItems()` remains unchanged and unpaginated for symbol mini BOM item
  selection.
- The route starts list rows and filter options concurrently. Canonical links
  omit page 1 and page size 50 while preserving active filters through paging,
  refresh, and browser history.
- The item wizard and delete confirmation use dynamic chunks. Create loads the
  wizard chunk and form options together; list edit loads the chunk, item detail,
  and form options together. Detail-page edit defers its chunk and form options.
- Save, delete, and archive retain the current URL. The wizard is closed before
  refresh so the updated server payload cannot lose a race with modal state.
- At 720 px and below, the shared application sidebar becomes a 64 px icon rail.
  The Items Library filter form stacks into usable full-width fields and the
  table uses a contained horizontal scroller, keeping the document width bound
  to the viewport.

## Indexes And Query Plans

The Prisma schema and idempotent SQLite bootstrap now include:

- `(status, displayName, itemKey)`
- `(status, category, displayName, itemKey)`
- `(status, manufacturer, displayName, itemKey)`

`EXPLAIN QUERY PLAN` against an isolated 1,000-row fixture confirmed:

- Default and search-ordered paths use `BomItem_status_displayName_itemKey_idx`.
- Category uses `BomItem_status_category_displayName_itemKey_idx`.
- Manufacturer uses `BomItem_status_manufacturer_displayName_itemKey_idx`.
- Combined category/manufacturer filtering uses the manufacturer composite and
  applies category as an additional predicate.
- Substring search does not receive a dedicated B-tree index; the status/order
  composite bounds active rows and preserves ordered delivery.

## Performance Evidence

The same isolated data shape was measured before and after Phase 3.

Before:

- 100 records: 100 returned, 63,229 serialized bytes, 16.37 ms median.
- 1,000 records: 1,000 returned, 641,038 serialized bytes, 110.02 ms median.
- Initial Items Library route shape: 7 Prisma queries.

After, using five warmed runs:

- 100 records: 50 returned, 22,462 serialized bytes, 4.07 ms median.
- 1,000 records: 50 returned, 22,464 serialized bytes, 3.66 ms median.
- Initial Items Library route shape: 5 Prisma queries, including the batched
  primary-image relation query.
- Payload growth from 100 to 1,000 records was 2 bytes, so list serialization is
  effectively independent of database size.

Five production-browser runs over 125 representative records recorded:

- Route/render times: 279.94, 101.44, 97.88, 121.51, 77.41 ms; median 101.44 ms.
- DOM content loaded: 130.20, 71.20, 34.60, 45.10, 53.10 ms; median 53.10 ms.
- Edit open: 676.10, 639.95, 326.44, 332.70, 583.75 ms; median 583.75 ms.
- Initial HTML/RSC response: 163,767 bytes on every run.
- Rendered list rows: 50 on every run.

The automated browser test also confirms there is no initial form-options server
action and no wizard/delete code marker in initially requested scripts. Each
chunk and its required server actions appear only after the matching control is
selected.

## Verification Coverage

- Vitest covers input defaults, trimming, array coercion, bounds, strict unknown
  fields, over-length filters, canonical URLs, active-filter detection, and the
  lean strict row DTO.
- The serial scalability Playwright suite seeds 125 active items plus an archived
  control without resetting the permanent sequence.
- Database coverage verifies all five search fields, exact and combined filters,
  archived exclusion, stable three-page identity, no duplicates/omissions, and
  full active-item delivery to symbol mini BOM selection.
- Browser coverage verifies default/page-size limits, totals, first/middle/last
  pages, out-of-range redirects, back/forward restoration, on-demand chunks and
  actions, create, edit, hard delete, referenced archive, URL preservation, and
  bounded 390 px mobile geometry.
- Test cleanup removes only uniquely prefixed items and its isolated symbol. It
  never modifies `BomItemKeySequence`.

Final verification results:

- `npm run db:generate`: passed.
- `$env:DATABASE_URL='file:./dev.db'; npm run db:setup`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run test`: 19 files and 154 tests passed.
- `$env:DATABASE_URL='file:./dev.db'; npm run build`: passed TypeScript and
  production route generation.
- The four BOM Playwright specifications passed 11 tests against the isolated
  production server, including the 390 px responsive geometry check.
- Manual inspection passed at the default 1280 px viewport and at 390 x 844 px.
  The mobile document stayed bounded to the viewport, main content measured
  311 px, the filter panel measured 283 px, and controls measured 251 px.

## Workspace And Remaining Risks

- Branch: `codex/bom-creator`
- Worktree: `C:\Web_Applications\EI_Designer-bom-creator`
- Phase 1 and Phase 2 work and unrelated Drawing/Networking changes were
  preserved.
- Offset pagination is suitable for the current thousands-of-records target.
  Cursor pagination remains a later measured option for substantially larger
  libraries.
- Leading-wildcard search still scans active ordered rows. SQLite FTS should be
  considered only if future measurements show search becoming dominant.
- The repository-wide Prisma configuration deprecation warning remains.
