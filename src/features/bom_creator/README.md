# BOM Creator

`bom_creator` owns the Items Library, symbol-level mini BOM templates, and live
drawing BOM generation.

## Scope

- Items Library stores reusable purchasable and consumable materials.
- Item records include general data, optional supplier/cost details, and
  multiple stored image references as data URLs.
- Symbol BOM templates link a symbol to reusable item rows with quantity rules.
- `/bom` generates a live BOM from a drawing package and current templates.
- `/bom/items` manages active library items with a create/edit wizard.
- `/bom/items/[id]` shows item details, image gallery, supplier/cost data, and
  symbol mini BOM usage.
- Symbol detail pages compose a BOM tab from this feature.

V1 does not save generated BOM revisions and does not calculate cable length.
Length-based items should use the `manual` quantity rule until drawing assets
store instance-level length data.

## Items Library

- `New item` opens a three-step wizard: General, Images, and Cost & Supplier.
- Item keys are permanent business identifiers allocated from the persistent
  `bom_item` sequence. Keys use `BOM-` with at least six digits, are immutable,
  and are never reused after an item is committed and later deleted.
- Images can be uploaded or pasted from the clipboard. V1 stores image data URLs
  directly with the item record, up to 12 images, 10 MiB per image, and 20 MiB
  total per item. Server validation decodes each base64 data URL and verifies
  its actual size rather than trusting the submitted file-size metadata.
- Ordinary list, detail, and edit reads expose image metadata and stable
  `/api/bom/items/images/{id}` URLs only. The image route decodes the stored data
  URL on demand and returns binary bytes with a strong ETag and private immutable
  browser caching.
- Existing images are saved as ID references. Caption, primary, and order edits
  preserve the image row and URL; removed IDs are deleted and new uploads are
  inserted transactionally.
- Row edit loads the full item detail before opening the same wizard.
- The Items Library list is URL-controlled through `q`, `category`,
  `manufacturer`, `page`, and `pageSize`. Search covers item key, display name,
  part number, manufacturer, and supplier name after the user submits the form.
- List queries return 50 rows by default, support 25/50/100 row controls, and
  never return more than 100 rows. Pagination is ordered by display name and
  permanent item key for stable page boundaries.
- List filter options use lean active-item queries. Full create/edit options,
  item detail, and the wizard/delete JavaScript are loaded only when their
  corresponding action is requested.
- On narrow screens the application sidebar becomes an icon rail, the filter
  form stacks into full-width controls, and populated item tables scroll within
  their panel rather than widening the page.
- Delete permanently removes unused items. The usage check and removal decision
  run in one database transaction. Items referenced by symbol mini BOMs are
  archived instead, preserving existing template links and generated BOM
  behavior.

## Quantity Rules

- `fixed_per_assembly` - line quantity per physical drawing asset.
- `per_cable_end` - line quantity multiplied by two.
- `per_conductor_termination` - line quantity multiplied by asset-associated
  drawing connections.
- `per_connection` - line quantity multiplied by asset-associated drawing
  connections.
- `manual` - no calculated quantity; BOM generation emits a warning.

## Generation Performance

- `/bom` loads lean drawing options, parses only the selected drawing model,
  restricts symbol identity reads to referenced IDs, and loads templates, lines,
  and reusable items in three bounded batch queries. A selected drawing uses no
  more than six database reads regardless of asset count.
- Generation builds asset, placement, sheet, symbol, template, source-tag, and
  connection indexes once. Connection-based rules use a precomputed unique
  connection count instead of scanning every drawing connection per line.
- Generated domain output remains live and complete on the server. URL-controlled
  `consolidated`, `assembly`, and `review` views send only the selected page to
  the browser. Defaults are 50 purchasing lines, 25 assemblies, and 50 warnings.
- Consolidated source-asset display is bounded to eight tag previews plus the
  total source count. The complete source tag list remains in the pure generated
  BOM result.
- Symbol detail pages perform no BOM reads until the BOM tab opens. The editor
  loads its current lean template on demand, and Add/Change uses a submitted,
  25-row active-item search dialog. Existing archived selections remain visible.
- `npm run benchmark:bom` executes warmed five-run 50, 500, and 2,500-asset
  generation benchmarks without introducing wall-clock assertions into CI.

## Verification

```powershell
npm run db:generate
$env:DATABASE_URL='file:./dev.db'; npm run db:setup
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'; npm run build
npm run benchmark:bom
npm run test:e2e -- tests/e2e/bom-creator.spec.ts tests/e2e/bom-creator-reliability.spec.ts tests/e2e/bom-creator-image-transport.spec.ts tests/e2e/bom-creator-scalability.spec.ts tests/e2e/bom-creator-performance.spec.ts --reporter=line
```

## Branch Baseline

- Isolation candidate: `codex/bom-creator-isolated`.
- Intended canonical branch: `codex/bom-creator`, currently preserved in the
  separate active worktree at `C:\Web_Applications\EI_Designer-bom-creator`.
- Base commit: `228f822` (`Complete drawing canvas milestone`).
- Recovery source: local branch `codex/mixed-work-safety-20260710`.
- Included domains: BOM routes, BOM persistence/bootstrap, symbol BOM
  composition, and BOM unit/E2E reliability coverage.
- Excluded domains: Networking and Detailed Panel Drawing code and persistence.
- Verification: Prisma generation passed, database setup passed twice, 2 BOM
  test files / 14 tests passed, lint and production build passed, and both BOM
  E2E specs passed with 4 tests.
