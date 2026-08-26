# Wire Catalog

The Wire Catalog stores approved global combinations of wire type, size, and
color. Internal panel wires copy an immutable specification snapshot so later
catalog edits do not rewrite issued drawing data.

- The first entry becomes the default automatically.
- Exactly one default is maintained while the catalog is non-empty.
- Deleting the current default requires a replacement when alternatives exist.
- Catalog records can be renamed or deleted without invalidating saved wire
  snapshots.
- A catalog entry never supplies the wire Description.

Run:

```powershell
npm run test -- src/features/wire_catalog/tests
```
