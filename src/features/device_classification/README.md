# Device Classification

Implementation status: software checks and the backed-up additive canonical migration passed on 8 October 2026; see the consolidated [release runbook](../../../docs/application/releases/2026-10-12.md). Detailed canonical receipts remain local. The complete manufacturer audit and catalogue/drawing classification corrections remain unfinished. The live software must not be confused with completed record revalidation.

## Ownership and scope

The client-safe registry in `src/shared/device-classification/` owns stable types, labels, ordering and explicit applicability families. This feature owns lightweight classification reads, evidence-required Symbol classification corrections, pure repair previews and read-only audit projection. Drawing mutations and history remain owned by `drawing_canvas`; Item facts remain immutable engineering revisions owned by `item_engineering`.

Exact selected Item revision is authoritative, followed by the exact pinned Symbol version, then an explicitly classified unlinked managed asset. Other is a deliberate type, not a loading/missing-data fallback. Missing and conflicting classifications remain visible. Names, tags, editable folders and Mini BOM line order never establish product identity or classification.

Built-in generated panels and terminal assemblies resolve through the drawing feature's narrow generated-reference contract. Exact symbol/version identity and owning asset type are required; arbitrary generated-looking IDs or metadata do not bypass catalogue checks. These assets retain their explicit drawing type without a fabricated catalogue record. Nested products and pinned Item selections remain independently checked.

UPS explicitly inherits power-supply attribute/template applicability. Chassis / Rack does not create channels, terminals, power requirements or a physical asset merely from its type. Capabilities and product configuration still determine engineering behaviour.

## User flows

- Symbol register and import use controlled Device Types. Historical managed categories remain in storage as evidence, with no category-management UI.
- Symbol Overview → Review classification loads an exact content token. Evidence is required; archived records and stale tokens are rejected. Only `SymbolVersion.deviceType` changes. SVG, metadata and Item pins remain byte-for-byte unchanged. Keep the downloaded before/after receipt with the audit register.
- Asset Manager groups through the same resolver. Identity → Review classification previews a snapshot-only correction. The command rereads its exact sources, checks the latest local model, creates one history entry, and does not save automatically. Approved/archived drawings are review-only.
- New linked equipment requires an explicit Symbol Device Type. Missing catalogue/loading failures do not silently create Other equipment. Existing references preserve physical identity and tags.

## Read-only census and repeatable review

`GET /api/device-classification/audit` produces a dated, fingerprinted snapshot and per-record outcomes without writes. It is an explicit administrative read, not a catalogue-row dependency. All reads occur inside a single transaction. Evidence metadata is included; attachment bytes are not.

1. Obtain a saved-draft checkpoint; capture the complete census before correction. Count packages, assets, nested products, occurrences and catalogue history separately.
2. Resolve each parse failure individually. An incomplete nested census prevents completion; the failed package remains in totals.
3. Check exact source ownership, classification conflicts, compatibility configurations, Mini BOM links, attachment availability, terminal mappings, historical digests and physical identity/BOM counting. Current automated checks are a starting structural audit, not the entire engineering review.
4. Review every current/used product against exact-variant manufacturer evidence, including Engineer Note images. Retain document edition/page/URL, conditional ratings, installation requirements and missing design facts. Unused history receives scoped integrity checks, not rewritten history.
5. Use supported correction operations. Item engineering changes append revisions; terminal/geometry changes append Symbol versions. Do not replace pinned drawing products or versions implicitly. Consequential engineering changes require a separate decision.
6. Reopen corrections, preserve receipts, repeat the census, reconcile added/changed records and issue a linked per-record register. Separate verified-within-scope, corrected/reverified, needs evidence, needs engineering decision, historical integrity and not-applicable outcomes. No automated outcome grants approval.

## Storage and recovery

The additive nullable/indexed column is introduced by `scripts/upgrade-device-classification-storage.ts`. Dry-run is the default. `--apply` requires the owned port-3000 runtime stopped, verifies canonical-main storage, creates and validates a recovery backup, and compares every pre-existing field/table fingerprint before and after. Restore rehearsals use only guarded synthetic storage.

Never restore a historical backup over later user work. For software rollback, retain the additive column and use a separately verified source state; data rollback is a separate maintenance operation. New receipts and backups remain local, outside version control. Do not run the general bootstrap against production as a substitute for this narrow migration.

## Verification

```powershell
npm run test -- src/shared/device-classification src/features/device_classification scripts/tests/device-classification-upgrade.test.ts
npm run lint
npm run typecheck
npm run test -- --maxWorkers=2
npm run audit:dependencies
```

Use the existing guarded runner with a unique `AUDIT_PHASE` for webpack builds and `scripts/device-classification/playwright.config.ts` for Chromium/Firefox on port 3121, one worker. Refuse occupied ports. Build files are shared with development: use a saved-draft maintenance window, synthetic SQLite, and restore the canonical runtime through `npm run dev:webpack` only after reviewing all gates.
