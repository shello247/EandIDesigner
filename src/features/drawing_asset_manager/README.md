# Drawing Asset Manager

`drawing_asset_manager` provides package-level asset management for drawing
packages. It works with the `drawing_canvas` public asset contract and keeps
asset logic pure so the canvas can apply changes through its existing model
history/save flow.

V1 assets live inside `Drawing.modelJson.assets`; no Prisma migration is
required. Existing drawings without explicit assets are reconciled from
placements when parsed or saved.

## Scope

- Shows assets in the active drawing package only.
- Groups assets by engineering type: instruments, controllers, panels,
  junction boxes, terminal blocks, breakers, cables, and other assets.
- Shows sheet associations by sheet number and sheet name.
- Includes Detailed Panel contexts and electrical occurrences as references
  without counting another physical asset.
- Creates unplaced package assets that can later be referenced by placement
  flows.
- Deletes only unplaced assets that are not used as containers.
- Does not show connections and does not manage occurrence relinking. The
  selected-placement Asset Identity / Asset Link workflow owns that.
- In read-only Detailed Panel deployments, protected panel assets remain
  viewable and server save guards prevent mutation bypass.

## Public Use Cases

- `buildManagedAssetCatalog(model, symbols)`
- `reconcileDrawingAssets(model, symbols)`
- `createManagedAsset(model, input, symbols)`
- `updateManagedAsset(model, assetId, updates, symbols)`
- `deleteManagedAsset(model, assetId)`
- `getAssetDeletionBlockers(model, assetId)`

## Verification

```powershell
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'; npx next build
```
