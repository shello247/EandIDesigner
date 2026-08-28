# Engineering Attributes

`engineering_attributes` defines controlled, typed, unit-aware facts for managed
drawing assets and structured terminal-strip members. The drawing package owns the values; this feature owns their
schema, catalogue, validation, normalization, formatting, and copy policy.

## Invariants

- Definition keys are permanent engineering identity. UI labels are not identity.
- Missing values are unknown and never normalize to zero.
- Stored values retain their selected unit. Fact projections use canonical units.
- Managed assets filter definitions by their asset-type applicability. Structured
  terminal-strip members may use the complete active controlled catalogue.
- The feature performs no engineering calculation.
- Future analysis features must consume `resolveEngineeringFacts()` through the
  public API instead of parsing drawing JSON or display labels.
- Properties and Asset Manager show a compact recorded-value list. Adding and
  editing values happens in the shared attribute dialog.
- Provenance remains part of the validated value contract, but v1 entry uses the
  internal `engineer_entered` default and does not expose provenance controls.

## Verification

```powershell
npm run test -- src/features/engineering_attributes/tests
```
