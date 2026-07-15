# BOM Creator

`bom_creator` owns the Items Library, symbol-level mini BOM templates, and live
drawing BOM generation.

## Scope

- Items Library stores reusable purchasable and consumable materials.
- Item records include general data, optional supplier/cost details, and
  multiple stored image references as data URLs.
- Symbol BOM templates link a symbol to reusable item rows with quantity rules.
- `/bom` generates a live BOM from a drawing package and current templates.
- `generateBomFromProjection` expands neutral physical-asset projections supplied
  by adjacent report features. Explicit quantity facts prevent duplicate visual
  routes from inflating panel BOM quantities.
- `BomAssemblyProjection` is the Detailed Panel reports boundary. BOM Creator
  retains item/template lookup, quantity expansion, archived/manual warnings,
  assembly lines, and consolidation; report features do not import BOM internals.
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
- Row edit loads the full item detail before opening the same wizard.
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

## Verification

```powershell
npm run db:generate
$env:DATABASE_URL='file:./dev.db'; npm run db:setup
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'; npm run build
npm run test:e2e -- tests/e2e/bom-creator.spec.ts tests/e2e/bom-creator-reliability.spec.ts --reporter=line
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
