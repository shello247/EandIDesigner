import { createHash } from "node:crypto";
import type { BomItemDocumentPayload } from "../../data/schema";
import { validateBomItemPdf } from "./bom-item-document-limits";

export type StoredBomItemDocumentPayload = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

function decodePdfDataUrl(dataUrl: string): Buffer {
  const prefix = "data:application/pdf;base64,";

  if (!dataUrl.startsWith(prefix)) {
    throw new Error("Stored BOM item document is not a base64 PDF data URL.");
  }

  const encoded = dataUrl.slice(prefix.length);
  if (
    encoded.length === 0 ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  ) {
    throw new Error("Stored BOM item document contains invalid base64 data.");
  }

  return Buffer.from(encoded, "base64");
}

export function buildBomItemDocumentPayload(
  document: StoredBomItemDocumentPayload
): BomItemDocumentPayload {
  const buffer = decodePdfDataUrl(document.dataUrl);
  const validation = validateBomItemPdf({
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    bytes: buffer
  });

  if (!validation.ok) {
    throw new Error(
      `BOM item document ${document.id} is invalid: ${validation.violations[0]?.message}`
    );
  }

  const bytes = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(bytes).set(buffer);
  const digest = createHash("sha256").update(buffer).digest("base64url");

  return {
    id: document.id,
    bytes,
    mimeType: "application/pdf",
    fileName: document.fileName,
    contentLength: buffer.byteLength,
    etag: `"sha256-${digest}"`
  };
}
