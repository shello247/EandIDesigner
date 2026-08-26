# PLAN-002-TASK-022 — PDF, print, and text compatibility report

Start: 2026-08-26 18:36 America/Port_of_Spain

End: 2026-08-26 18:47 America/Port_of_Spain

Duration: approximately 11 minutes

## Result

Preview, print, and PDF exports remain engineering- and layout-equivalent to the frozen baseline for deterministic 10-, 40-, and 120-sheet packages. Five sequential PDFs were generated for every size. Page count, order, page dimensions, extracted text, connected-wire schedule content, expected route labels, and representative rendered pixels all match.

The audit fixture bootstrap now restores drawing title, key, status, and model JSON on every run. This corrects test contamination from an earlier save-transport probe without deleting or changing any canonical data. The first Task 22 export run retained the contaminated 40-sheet title as negative evidence; the deterministic rerun produced byte-identical print HTML for all sizes.

No export product code changed. The only implementation changes are reusable audit-fixture reset and guarded candidate/baseline PDF QA tooling.

## Verification

- Five sequential PDFs passed for each of 10, 40, and 120 sheets; all responses were valid PDFs with stable output byte counts within each size.
- Print HTML is byte-identical to baseline for all three sizes.
- Candidate and baseline have exactly 10/10, 40/40, and 120/120 pages.
- Extracted per-page text hashes and page sizes match baseline for every page.
- Sheet names appear in the correct page order for every page.
- No expected route label is missing from extracted text.
- Pages 1, 4, and last for every size have identical dimensions and pixel hashes after Poppler rendering.
- Nine candidate representative pages were visually inspected; no candidate-only clipping, overlap, missing schedule, missing wire, title-block shift, or glyph defect was found.
- Sixteen guarded audit/runner contracts, full lint, and standalone type-check pass.

The initial ordinary Vitest invocation correctly returned “No test files found” because repository Vitest intentionally excludes audit tests. It is retained; the same two files pass through the dedicated audit configuration.

## Export timings

Five sequential observations are reported as median and range, not p95:

| PDF size | Baseline median (range) | Candidate median (range) | Change |
|---|---:|---:|---:|
| 10 sheets | 3,696.22 ms (3,608.85–3,775.75) | 2,129.00 ms (2,079.10–2,533.57) | 42% faster median |
| 40 sheets | 7,192.32 ms (6,946.45–8,385.51) | 4,161.25 ms (4,057.96–4,212.87) | 42% faster median |
| 120 sheets | 16,277.66 ms (13,543.10–25,047.08) | 9,781.65 ms (9,679.87–9,825.89) | 40% faster median |

Output sizes remain 1,049,312 bytes, 3,308,141 bytes, and 9,332,918 bytes respectively. Print preparation improved from 1,434.88 to 217.77 ms (10 sheets), 1,715.61 to 199.15 ms (40 sheets), and 1,825.02 to 479.47 ms (120 sheets). Preview first-visible timings improved from 563.70 to 145.00 ms, 333.00 to 115.10 ms, and 547.60 to 134.70 ms.

## Search/copy compatibility caveat

Expected engineering route labels are present and searchable. Literal canonical wire IDs are not always present as contiguous extracted text: 15, 50, and 150 IDs respectively are absent because explicit field labels replace some route IDs and the PDF font extraction contains the same private-use punctuation code points as baseline (`U+E081`, `U+E082`, `U+E088`, `U+E08B`, and `U+E092`).

This is unchanged compatibility behavior, not a missing-graphic finding. Visual pixels and extracted text hashes match baseline. Improving copy/paste punctuation would require a separate export-font/text-layer change and is not included in this pass.

## Evidence and recovery

Authoritative evidence is under `artifacts/drawing-performance/pass-1/task022-exports-v2/`: raw browser timings, five PDF results per size, print HTML, candidate PDFs, `pdf-qa.json`, `export-parity.json`, and representative Poppler PNGs. `task022-exports-v1` is retained as the contaminated-title negative run.

The source checkpoint and exact remote verification are recorded in the following recovery-map update. Port 3000, the canonical database, and the original worktree remain untouched.

