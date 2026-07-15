# BOM Creator Phase 2 Handoff

Date: 2026-07-10 (America/Port_of_Spain)

## Objective

Remove stored image data URLs from ordinary list, detail, hydration, edit-load,
and edit-save payloads while retaining SQLite data URLs as the Phase 2 storage
model.

## Delivered Architecture

- List and detail queries explicitly select image metadata and build stable
  `/api/bom/items/images/{id}` URLs. They never select `dataUrl`.
- The image route is the only browser delivery path. Its feature-owned payload
  query decodes the stored base64, verifies MIME and byte length, and computes a
  strong SHA-256 ETag.
- Successful responses include binary bytes, `Content-Type`, actual
  `Content-Length`, `ETag`, `X-Content-Type-Options: nosniff`, and
  `Cache-Control: private, max-age=31536000, immutable`.
- Matching `If-None-Match` requests return `304`; missing IDs return `404` with
  `private, no-store`.
- Existing edit images use discriminated ID references. Only newly uploaded or
  pasted images carry data URLs in a server-action request.
- Reconciliation verifies image ownership, combines stored and new sizes for
  Phase 1 budget enforcement, skips unchanged rows, updates metadata in place,
  deletes omitted rows, creates new rows, normalizes order, and assigns the
  first image as primary when necessary.
- Persisted PNG/JPEG/WebP/AVIF images use `next/image`. Unsupported optimizer
  formats and unsaved data-URL previews use native lazy image delivery.

No Prisma schema, bootstrap, server-action limit, supplier/cost, symbol BOM, or
drawing BOM changes were required.

## Preflight

The development database contained no BOM item images. No invalid data URLs,
MIME mismatches, size mismatches, or records requiring repair were found.

## Performance Evidence

An isolated item with two 10 MiB images was measured five times using the old
full-image query/serialization shape and the new metadata-only shape:

- Old times: 419.50, 409.24, 433.68, 430.39, 376.97 ms; median 419.50 ms.
- New times: 3.06, 3.14, 5.81, 2.83, 5.64 ms; median 3.14 ms.
- Old serialized payload: 27,963,204 bytes.
- New serialized payload: 994 bytes.
- Measured payload reduction: 99.99645%.

The hard 95% reduction gate passed. Automated DTO and page-response checks also
confirm that ordinary item payloads contain no `data:image/` content.

## Verification

- `npm run lint`: passed.
- Full Vitest suite: 18 files and 148 tests passed; the three BOM files contain
  20 passing tests.
- Production build and TypeScript checking: passed.
- BOM Playwright suites: 7 tests passed against isolated `test-e2e.db` using
  the production server.

The Playwright coverage verifies exact image bytes, MIME/length headers, strong
ETags, `304`, `404`, private caching, metadata-only DTOs/page responses, stable
IDs, normalized ordering, selective removal, foreign-image rejection, list and
detail rendering, edit paste, captions, and primary selection.

## Cache And Storage Rules

- Image bytes are immutable for the lifetime of an image ID. Replacement creates
  a new row and URL.
- Metadata edits do not invalidate byte caches because the byte content and URL
  remain unchanged.
- Deleted images can remain in a browser's private cache until eviction, but the
  application removes all references and a server request returns `404`.
- SQLite still incurs one base64 decode for the first uncached request. External
  object storage remains a later phase.

## Workspace And Remaining Risks

- Branch: `codex/bom-creator`
- Worktree: `C:\Web_Applications\EI_Designer-bom-creator`
- Existing Phase 1 work and unrelated Drawing/Networking changes were preserved.
- The repository-wide Prisma configuration deprecation warning remains.
- A stale generated `.next/dev` cache from a previous mixed branch initially
  referenced Networking routes; clearing that generated cache produced a clean
  production build without source changes.
