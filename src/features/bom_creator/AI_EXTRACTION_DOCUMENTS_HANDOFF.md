# BOM Item AI Extraction and Documents Handoff

## Delivered

- Create-only product URL extraction using OpenAI Responses API structured
  output and domain-restricted `web_search`.
- Blank-field merge behavior with source, confidence, and warning review UI.
- Persisted `productUrl` and `productUrlExtractedAt` provenance.
- Four-step item wizard with PDF staging, titles, capacity display, downloads,
  confirmation-based deletion, progress, and partial-failure retry.
- `BomItemDocument` SQLite storage with metadata-only reads and immutable binary
  delivery at `/api/bom/items/documents/{id}`.
- Item detail source and document panels.

## Invariants

- AI runs only after explicit user action and only in create mode.
- Page content is treated as untrusted data; unsupported facts remain null.
- Existing draft values are never overwritten by extraction.
- Allowed categories come from current form options; allowed units come from the
  shared BOM option service.
- No API key, raw model response, image data URL, or PDF data URL reaches list or
  detail client DTOs.
- PDFs are limited to 25 MiB each, six files, and 50 MiB aggregate.
- Existing image limits and generated BOM behavior are unchanged.
- Networking worktree changes were not read into or written by this feature.

## Save Sequence

1. Create or update the item and reconcile images.
2. Notify the list/detail parent as soon as the item exists.
3. Upload staged PDFs sequentially with separate FormData actions.
4. On failure, retain the item ID, completed uploads, and failed staged file.
5. Retry updates the same item and uploads remaining files; it never creates a
   second item.

## Verification Record

- SQLite bootstrap: passed against the populated shared database; the new
  document table contained no pre-existing records requiring remediation.
- Live OpenAI acceptance: Phoenix Contact product page returned high-confidence
  structured manufacturer, part number, category, unit, and one source without
  warnings.
- Vitest: 66 files, 352 tests passed.
- BOM Playwright regression: 14 tests passed across reliability, image
  transport, scalability, generation performance, extraction, and documents.
- Lint and production build: passed.

## Deferred

- Direct PDF URL extraction, non-PDF documents, automatic page media downloads,
  multiple source URLs, quote history, object storage, permissions, and
  autonomous purchasing remain outside this increment.
