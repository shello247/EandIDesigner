# Item Engineering

## Current workflow — PLAN-011

Profile v3 extends immutable Item revisions with stable specification entries,
scopes, explicit modes, structured retained evidence, unknowns and product
terminals/channels. v1/v2 readers and their hashes remain unchanged. The current
Item UI uses one editable table and atomic Save changes; the individual-row
editor described below is a historical interface.

Public batch/evidence actions live in `api/batch-actions.ts`; product
qualification and exact selection reads in `api/product-actions.ts`. Public
client-safe contracts are in `api/contracts.ts`, server services in
`api/server.ts`. Consumers must not import persistence internals.

Classification is advisory. Numeric validity, unit dimensions, retained source
ownership, terminal identity and compare-and-swap revision tokens remain strict.
Batch preview returns row paths; failed saves write nothing. Conflict review
requires explicit reconciliation and retry. Hidden-tab and in-flight drafts are
retained. Archived Items are read-only.

Symbol configurations qualify exact Item revisions and map product terminals to
existing Symbol keys. Drawing v3 selects a primary product per physical identity,
including strip members and nested positions. Project modes, explicit supplies,
channel ranges, terminal installation details and assumptions remain separate
from manufacturer facts. Newer Item revisions require comparison and deliberate
adoption; historical data is never silently replaced.

`resolveEffectiveEngineeringFacts` excludes ambiguous/unsupported facts from
unambiguous calculation. A controlled seed identity and authoritative type
revision are required for analysis meaning; a custom label cannot forge it.
Evidence metadata is lazy and exact revision reads are batched. Both BOM paths
use the selected-product resolver.

The additive storage upgrade installs `SymbolItemConfigurationOption.interfaceJson`.
Catalogue reconciliation adds immutable typed definitions/unit revisions and
produces a record-review preview without rewriting Item profiles. See the
[workflow guide](../../../delivery/reports/PLAN-011-workflow-guide.md) and
[implementation plan](../../../delivery/plans/completed/PLAN-011-engineering_attribute_workflow.md)
for usage, acceptance, qualification and cutover boundaries.

## Historical implementation notes (superseded where noted above)

Owns Item-specific engineering profiles and exact product-selection contracts.
Includes validated contracts, protected SQLite storage, atomic Item revisions and
exact historical queries and the tabbed Item engineering workspace. The canonical
database rollout remains separately gated.

- Reuses controlled engineering attribute definitions, units and provenance.
- Keeps device, supply-input and supply-output facts in named groups.
- Treats terminal conductor ranges separately from installed wire sizes.
- Rejects malformed/unknown attributes. Reports contextual contradictions without
  inventing values or marking manufacturer claims as approved.
- Explicit selection requires configuration, Item and engineering-revision IDs.
  Referential checks will be added at the persistence boundary; schema validity
  alone does not establish a compatible product.
- Existing drawing attribute containers and model versions are unchanged.

Run:

```powershell
npm run test -- src/features/item_engineering/tests/item-engineering-contracts.test.ts src/features/engineering_attributes/tests
npm run typecheck
```

## Revision services

- New snapshots capture product identity, typed profile and hashed guidance references.
- The expected latest revision is checked inside the transaction. No-op submissions
  reuse the revision; commercial-only price/supplier changes create no electrical revision.
- Product identity edits with an existing profile require the expected revision and
  atomically create a new snapshot. The Item workspace supplies the current token.
- Notes/documents must belong to the Item. Archived guidance already pinned can be
  retained; newly attaching archived guidance is rejected.
- Exact reads return metadata/facts only and verify the snapshot hash. They never
  substitute newer revisions or return image/PDF bodies.
- Historical references protect Items from deletion; deletion archives them instead.
- The guarded storage command is dry-run first; use it only during the approved rollout.

## Item guidance

- New Item notes begin empty; no symbol notes are copied or removed by these services.
- Notes support 20,000 characters and an optional PNG/JPEG/WebP snippet (10 MB each,
  20 MB across active notes; 128 active notes per Item).
- Replacement creates a new note, archives the old one and atomically updates the
  latest engineering revision. Historical snapshots keep their exact old guidance.
- Lists are paginated at 25 rows and exclude image bodies; image details load on demand.
- Existing PDF upload/download validation is reused. New uploads pin content hashes;
  referenced removal archives the document, retaining historical downloads.
- Guidance mutations require the expected latest engineering revision when a profile exists.
  Before the first profile, guidance can be authored without inventing an electrical classification.
- Server actions validate input and return typed success/error envelopes. No drawing route is refreshed.

## Item workspace

- Engineering Attributes and Engineer Notes are exposed through ui/public.ts.
- A shared mutation queue serializes profile, identity, note and document operations.
  Tokens advance only after success. Section drafts persist across hidden tabs;
  submitted snapshots alone are acknowledged, preserving in-flight edits.
- Profile-only saves resolve committed guidance membership transactionally. Guidance
  created before the first profile is included; stale client arrays cannot detach it.
- Attribute source editing is opt-in on the shared field/card controls. Drawing
  callers retain their existing interface. Incompatible device-type values are
  retained until explicitly resolved; missing ratings never default to zero.
- Dirty links and supported browser navigation/unload display a leave warning.
- Archived Items are read-only. No approval workflow or automatic specification inference.
- Note summaries are capped to 280 characters; full text and images load on opening.
- Specifications, notes and documents have independent loading/retry states.

Configuration services, selection commands and BOM integration remain subsequent
PLAN-006 tasks. Symbol-owned guidance is retired under the explicit September 8
deletion amendment; Item guidance is not migrated from that storage. Test with guarded synthetic
SQLite on port 3120, not the shared canonical port 3000.

## Individual attribute workspace (Task 007 follow-up)

- Engineering Attributes now displays searchable 25-row pages with independent
  Add/Edit/Remove dialogs. Row saves commit immediately; there is no whole-section
  attribute Save. Classification has its own guarded dialog.
- Version-1 profiles and historical hashes remain readable unchanged. A read-only
  adapter projects them into table rows; the first engineering mutation saves a
  version-2 revision. The extra terminal-limits group supports the full 32 legacy
  groups without dropping ungrouped limits. Long conditions remain in their
  structured payload, not a truncated/duplicated scalar.
- Version 2 pins server-resolved exact type definitions and stable entry identities.
  Titles/descriptions are Item-specific. Scalar types remain unique per group;
  conditional ratings and conductor ranges retain independent identities.
- Row commands merge only the requested change into the committed profile and
  preserve current guidance membership. Direct full-profile saves also verify type
  snapshots, preventing fabricated analysis identifiers or definition contents.
- The existing mutation queue advances only after successful saves. Failed/conflicting
  saves retain drafts. Explicit comparison and retry are required for stale entries.
  Later edits, including specification-group changes, remain unsaved in the dialog.
- Numeric blanks are not zero. Limits normalize selected units into the definition's
  default unit. Conditional ratings retain voltage, AC/DC, designation and evidence;
  conductor limits retain terminals, conductor class and termination conditions.
- Archived Items are readable only. No approval, compatibility, drawing-selection,
  symbol-note retirement or canonical catalogue change is included.
- The guarded Item preview displays a synthetic-data notice on Item pages only,
  avoiding any layout change in Symbol Registry or drawing consumers.

Verification and recovery: delivery/reports/PLAN-006-TASK-007-attribute-editor.md.

## Library ordering

The grip on each active note supports drag-and-drop and keyboard Up/Down/Home/End.
Moves save automatically. Library position is presentation metadata, not an
electrical revision or immutable note-content change. Existing notes retain
newest-first order until arranged; new notes then append and replacements retain
their position. Stale order tokens require a Library refresh and a deliberate retry.
Reordering is unavailable while archived history is shown. Note bodies remain lazy.
The additive nullable position column is installed only through the guarded storage
bootstrap/upgrade. See `delivery/plans/PLAN-006-note-library-order.md` for scope.
