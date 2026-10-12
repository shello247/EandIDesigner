# Engineering Attributes

## PLAN-011 shared definitions

The shared type library also serves Item profile v3 and drawing product facts.
Applicability ranks suggestions and produces advisory warnings in the Item
workflow. `unit-catalog.ts` and `normalize-engineering-value.ts` own conversion:
absolute/delta temperature, time, resistance, torque, mass, ratio, electrical
and length units, and explicit logarithmic AWG conversion. Original units remain
recorded; normalized values are calculated separately.

Starter templates contain no values. System definitions have stable identities
and immutable revisions. Custom definitions are retained information but cannot
claim system analysis semantics. The guarded catalogue upgrade adds definitions
or unit revisions without rewriting prior revisions or Item facts.

The following describes legacy drawing-owned attributes; selected products now
use `item_engineering.resolveEffectiveEngineeringFacts` through its public API.

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

## Item Attribute Types library

- Items use a SQLite-backed type library with immutable, SHA-256-verified definition
  revisions. The existing drawing catalogue and drawing-side editor are unchanged.
- Definitions own format, engineering dimension, controlled units, numeric limits,
  precision, selections and applicability. Definition identity/analysis meaning is
  system-controlled; a name change does not reinterpret engineering data.
- Existing catalogue definitions plus Starting Current, Inrush Current, Length,
  conditional short-circuit ratings and terminal conductor limits seed idempotently.
  Never change the meaning of a seeded version-1 identity in place.
- Lifecycle is create/edit/retire/restore; there is no permanent-delete interface.
  Format, dimension and structured payload kind cannot change on an existing type.
- Custom types are usable immediately but do not become supported analysis facts.
  No arbitrary units or conversion formulas are accepted.
- Cross-feature consumers use api/public.ts, api/server.ts and ui/type-library.ts.
  Item type management is loaded only when opened.

## Verification commands

```powershell
npm run test -- src/features/engineering_attributes/tests
```
