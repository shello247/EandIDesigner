import type { DrawingModel } from "../../data/schema";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildDrawingPdfPrintHtml({
  title,
  sheet,
  svg,
  drawingUrl
}: {
  title: string;
  sheet: DrawingModel["sheet"];
  svg: string;
  drawingUrl?: string;
}): string {
  const safeTitle = escapeHtml(title.trim() || "Engineering Drawing");
  const toolbar = drawingUrl
    ? `<nav class="print-toolbar" aria-label="Print actions">
        <a href="${escapeHtml(drawingUrl)}">Back to drawing</a>
        <button type="button" id="print-button">Print / Save PDF</button>
        <span id="print-status" role="status" aria-live="polite">Use Ctrl+P if your browser blocks print.</span>
      </nav>`
    : "";
  const printScript = drawingUrl
    ? `<script>
      function requestPrint() {
        const status = document.getElementById("print-status");

        if (status) {
          status.textContent = "Opening print dialog...";
        }

        window.setTimeout(function () {
          window.focus();
          window.print();
        }, 50);
      }

      window.addEventListener("load", function () {
        const button = document.getElementById("print-button");

        if (button) {
          button.addEventListener("click", requestPrint);
        }
      });
    </script>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      @page {
        size: ${sheet.width}mm ${sheet.height}mm;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: ${sheet.width}mm;
        min-height: ${sheet.height}mm;
        margin: 0;
        padding: 0;
        background: #ffffff;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .drawing-page {
        width: ${sheet.width}mm;
        height: ${sheet.height}mm;
        overflow: hidden;
        background: #ffffff;
      }

      .drawing-page > svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .print-toolbar {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 10;
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
        font-family: Arial, Helvetica, sans-serif;
      }

      .print-toolbar a,
      .print-toolbar button {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #ffffff;
        color: #0f172a;
        cursor: pointer;
        font: 600 12px Arial, Helvetica, sans-serif;
        padding: 7px 10px;
        text-decoration: none;
      }

      .print-toolbar button {
        background: #0f766e;
        border-color: #0f766e;
        color: #ffffff;
      }

      .print-toolbar span {
        max-width: 190px;
        color: #64748b;
        font: 500 11px Arial, Helvetica, sans-serif;
        line-height: 1.25;
      }

      @media print {
        .print-toolbar {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    ${toolbar}
    <main class="drawing-page">${svg}</main>
    ${printScript}
  </body>
</html>`;
}
