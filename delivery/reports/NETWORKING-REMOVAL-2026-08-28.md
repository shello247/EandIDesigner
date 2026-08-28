# Standalone Networking Product Removal

Date: 2026-08-28

Branch: `codex/remove-networking`

Base: `a388870e97e4e0a87fff519f4203ac9158e46409`

## Outcome

The standalone network-map product has been removed from the candidate source
and from the canonical SQLite database. Former networking and network-map asset
routes return `404`. The physical Network Device engineering capability remains
available in Symbol Registry, Asset Manager, Panel Equipment, drawings, and
electrical connectivity.

No drawing JSON, wire, terminal, symbol-version, BOM, or panel-wiring records
were changed by the storage retirement.

## Local checkpoints

- `37ce9dc` — guarded archive and storage-retirement utility.
- `8b51c0d` — networking routes, feature, map UI, tests, and map-only symbol
  adapters removed.
- `bc98111` — Prisma/bootstrap persistence declarations and current docs
  updated.
- `05b55ae` — browser tests aligned with the already-current Sheet Loader,
  Asset Manager, hidden Panel Deliverables UI, and adaptive SVG markers.

The branch is local and unpublished. No pull request or merge was performed.

## Canonical storage retirement

The server was stopped before the apply run. The utility resolved only the
canonical main database, validated one historical `NetworkMap`, obtained
exclusive SQLite access, wrote the recovery set, dropped the table in an
exclusive transaction, and compared every unaffected table fingerprint.

Recovery location (local and ignored):

`artifacts/networking-retirement/20260828T183005491Z-05b55ae0e94c/`

| File | Bytes | SHA-256 |
|---|---:|---|
| `pre-retirement-dev.db` | 40,722,432 | `121D0B6D38BCEC094B79C2A5841E0CB65FB6F09FD8D585F9BC71761F63565B12` |
| `network-maps.json` | 802 | `8309438EAD87EF39989EABE6B70458C4B31F063010278F4A686C94218F541AA3` |
| `manifest.pre-drop.json` | 3,104 | `4CDB6CD9FED16F2827849601FE2E07CAE244B03FC45D1DDFF89F21D473DAE4D6` |
| `manifest.json` | 5,580 | `A398840C9E1AEB32E560D08FD8360A351AD9AD09896091B2AA7214C973DA2426` |

Manifest result:

- State: `retired-and-verified`.
- Source commit: `05b55ae0e94c1a03dff695338b51afdc79d2a536`.
- Tables before: 19.
- Tables after: 18.
- Only removed table: `NetworkMap`.
- All 18 unaffected table counts and hashes matched.
- An immediate `--apply` rerun returned `NetworkMap is already absent`.

Rollback requires stopping the server, reverting the removal source, and
restoring `pre-retirement-dev.db`. The archive must remain local and must not be
committed.

## Verification

Passed:

- `npm run audit:dependencies`
- `npm run lint`
- `npm run typecheck`
- `npm run test -- --maxWorkers=1` — 125 files, 753 tests.
- Production build against a freshly bootstrapped isolated SQLite database.
- `npm run test:e2e -- --reporter=line --workers=1` — 59 tests.
- Retirement utility — dry-run, apply, invalid model, existing archive,
  database lock, unsupported argument, and idempotent rerun coverage.
- Fresh isolated bootstrap — zero `NetworkMap` tables.
- Build route manifest — no `/networking` or network-map asset routes.
- Live HTTP smoke check — `/symbols`, `/drawings`, and `/bom` return `200`;
  all former networking/map asset routes return `404`.
- Live read-only UI check — no Networking navigation link or browser console
  errors.
- Canonical drawing check — `SW-101` remains an `Industrial Ethernet Switch`
  under `NETWORK DEVICES` in Asset Manager and remains a represented
  `network device` in Panel Equipment with its terminal usage intact.

Observed and resolved during verification:

- One parallel full-unit run timed out in the unrelated Excel workbook test;
  the test passed immediately in isolation and the serialized full suite passed.
- The first full browser run exposed stale locators for the collapsed Sheet
  Loader, no-default-selection Asset Manager, previously hidden Panel
  Deliverables menu, and adaptive dense-marker sizing. The tests were updated
  to exercise the current interfaces and retain their engineering assertions;
  the final full browser run passed 59 of 59.
- A build attempted against an unbootstrapped worktree database failed as
  expected. The guarded, freshly bootstrapped isolated database build passed.

## Running state

Port `3000` is running from the `remove-networking` linked worktree through
`npm run dev:webpack`, using the canonical main SQLite database through the
guarded development launcher. Canonical `main` remains unchanged and clean.

## Remaining decision

User acceptance testing is next. Publication, squash pull request, merge into
`main`, removal of the feature worktree, PostgreSQL migration, access control,
and any replacement network-analysis capability remain separate decisions.
