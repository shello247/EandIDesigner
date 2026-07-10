# BOM Creator Phase 1 Handoff

Date: 2026-07-10 (America/Port_of_Spain)

## Objective

Make BOM item identifiers permanent and concurrency-safe, enforce the complete
item-image budget on both client and server, and make item removal decisions
transactional without changing live BOM quantity behavior.

## Delivered Invariants

- The singleton `BomItemKeySequence` row uses scope `bom_item`.
- New item keys are allocated by an atomic sequence increment inside the item
  creation transaction and formatted as `BOM-` plus at least six digits.
- A committed item key is never reused after deletion. A rolled-back creation
  may reuse its uncommitted increment because the increment rolls back with the
  item transaction.
- Bootstrap raises the sequence to the highest valid existing `BOM-<digits>`
  key but never lowers an existing sequence. Non-numeric custom `BOM-` keys are
  ignored.
- Item keys are read-only. Strict create and update schemas reject payloads that
  contain `itemKey`.
- Each item can store at most 12 images, 10 MiB per image, and 20 MiB in total.
  The server decodes base64 data URL lengths and rejects invalid URLs or declared
  size mismatches.
- Upload and clipboard paste share the wizard's `addFiles()` path and validate
  combined existing/incoming capacity before data URL conversion.
- Item removal counts template usage and chooses hard delete or archive in one
  transaction. The `onDelete: Restrict` relation remains the final safeguard.
- Archived template items remain available to live generation and emit the
  existing `archived_item` warning.

## Data Preflight

The read-only preflight against the development database found:

- BOM items: 0
- Highest generated sequence: 0
- Malformed `BOM-` keys: none
- Items above the 20 MiB aggregate image limit: none

No existing records were changed.

## Verification

- `npm run db:generate`: passed.
- `DATABASE_URL=file:./dev.db; npm run db:setup`: passed twice; the second run
  preserved the sequence row and value.
- `npm run lint`: passed.
- BOM Vitest files: 14 tests passed.
- Full `npm run test`: 196 passed, 1 unrelated Drawing Panel Wiring assertion
  failed in `panel-connectivity-graph.test.ts` because the helper returns the
  full termination record while the test expects only provenance fields.
- Production compilation passed, then the build stopped on an unrelated type
  error in `drawing_panel_wiring/logic/services/external-termination-catalog.ts`.
- BOM Playwright specs: 4 tests passed against the isolated `test-e2e.db` using
  a development server because the unrelated type error prevents `next start`
  from receiving a completed production build.

The Playwright reliability suite verifies bootstrap state, deletion non-reuse,
concurrent `Promise.all` allocation, hard deletion, archive preservation, live
generation warnings, file upload, and a real clipboard image event. Cleanup
deletes only records created by the suite and never modifies the sequence.

## Deferred Work And Risks

- Image storage remains SQLite data URLs for V1. External object storage and
  image transformation are deferred.
- Sequence gaps are expected after deleted committed items.
- The Prisma package configuration deprecation warning remains repository-wide.
- Pagination, permissions, export, saved BOM revisions, new quantity rules, and
  Drawing/Networking changes remain outside this phase.
- The unrelated Drawing Panel Wiring test/type failures must be resolved on its
  owning branch before the standard production-build-backed E2E command passes.

## Workspace

- Branch: `codex/bom-creator`
- Isolated worktree: `C:\Web_Applications\EI_Designer-bom-creator`
- The original Drawing/Networking workspace was not modified by this phase.

The repository does not currently contain Delivery OS files, so this handoff is
stored with the owning feature rather than under `delivery/reports`.
