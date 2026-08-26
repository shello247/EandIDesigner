# PLAN-001-TASK-006 — Save, preview, print and PDF

Status: complete with recorded limitations. Investigation only; not a claim that all tests/budgets pass.

Run: `20260826-baseline`. UTC command timestamps and durations are in the referenced `*-start.json` / `*-result.json` files. Work packages were interleaved; command durations are not exclusive task labor estimates. Local summaries use America/Port_of_Spain (UTC−04:00).

Forty-sheet save acknowledgment median/p95 was 479.8/784.6 ms. Thirty saves produced thirty drawing POSTs and 400 background GET prefetches; these are not 430 writes or SQL queries. Five separate diagnostic probes captured 203,977-byte requests and 464,541-byte decoded responses.

Five baseline PDFs per 10/40/120-sheet package had medians 3.70/7.19/16.28 seconds. Reported ranges and individual samples are retained, with no PDF p95. Diagnostic stage measurements show PDF printing dominates Chromium launch; all fifteen launches had closes.

All three print HTML outputs match byte-for-byte. All PDF page counts/order/text/page sizes match; nine representative page pairs are pixel-identical. Representative synthetic drawings and scaling charts were visually inspected.

Evidence: baseline/diagnostic browser JSON, both server diagnostic logs, five-save probe, fifteen export samples, representative PDFs/PNGs, `pdf-qa.json`, `pdf-qa-v1.json`, `export-parity.json`.

Verification: serial `exports` and `save response payload` workloads; `pdf-qa.py` then `export-parity.mjs`.

Limitations: preview/print timings are single observations per size; later-page preview scrolling is not exhaustively timed. Node memory samples exclude Chromium children. PDF punctuation extracts as private-use characters in some labels; viewer search/copy remains unverified, and unavailable pdftotext prevented a second extractor check. Synthetic layouts are not polished manufacturer drawings.

Raw evidence path: `artifacts/drawing-performance/20260826-baseline/`. Source/fixture definitions and hashes are shared with the main assessment and reproduction guide.

