import { describe, expect, it } from "vitest";
import { bomItemDocumentMetadataSchema } from "../data/schema";
import {
  MAX_BOM_ITEM_DOCUMENT_BYTES,
  MAX_BOM_ITEM_DOCUMENTS,
  MAX_BOM_ITEM_TOTAL_DOCUMENT_BYTES,
  validateBomItemDocumentBudget,
  validateBomItemPdf
} from "../logic/services/bom-item-document-limits";
import { buildBomItemDocumentPayload } from "../logic/services/bom-item-document-payload";

const pdfBytes = Buffer.from("%PDF-1.4\n%%EOF\n");
const pdfDataUrl = `data:application/pdf;base64,${pdfBytes.toString("base64")}`;

describe("BOM item documents", () => {
  it("enforces document count, individual, and aggregate budgets", () => {
    const tooMany = validateBomItemDocumentBudget(
      Array.from({ length: MAX_BOM_ITEM_DOCUMENTS + 1 }, () => ({ sizeBytes: 1 }))
    );
    const tooLarge = validateBomItemDocumentBudget([
      { sizeBytes: MAX_BOM_ITEM_DOCUMENT_BYTES + 1 }
    ]);
    const overTotal = validateBomItemDocumentBudget([
      { sizeBytes: MAX_BOM_ITEM_DOCUMENT_BYTES },
      { sizeBytes: MAX_BOM_ITEM_DOCUMENT_BYTES },
      { sizeBytes: 1 }
    ]);

    expect(tooMany.violations.map((item) => item.code)).toContain("count");
    expect(tooLarge.violations.map((item) => item.code)).toContain(
      "individual_size"
    );
    expect(overTotal.totalBytes).toBe(MAX_BOM_ITEM_TOTAL_DOCUMENT_BYTES + 1);
    expect(overTotal.violations.map((item) => item.code)).toContain(
      "aggregate_size"
    );
  });

  it("validates PDF MIME, extension, signature, and declared size", () => {
    expect(
      validateBomItemPdf({
        fileName: "datasheet.pdf",
        mimeType: "application/pdf",
        sizeBytes: pdfBytes.byteLength,
        bytes: pdfBytes
      }).ok
    ).toBe(true);
    expect(
      validateBomItemPdf({
        fileName: "datasheet.txt",
        mimeType: "text/plain",
        sizeBytes: 99,
        bytes: Buffer.from("not a pdf")
      }).violations.map((item) => item.code)
    ).toEqual(
      expect.arrayContaining([
        "mime_type",
        "file_extension",
        "signature",
        "size_mismatch"
      ])
    );
  });

  it("builds exact immutable binary payloads and strong ETags", () => {
    const first = buildBomItemDocumentPayload({
      id: "document_1",
      fileName: "datasheet.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      dataUrl: pdfDataUrl
    });
    const second = buildBomItemDocumentPayload({
      id: "document_1",
      fileName: "datasheet.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      dataUrl: pdfDataUrl
    });

    expect(Buffer.from(first.bytes)).toEqual(pdfBytes);
    expect(first).toMatchObject({
      mimeType: "application/pdf",
      fileName: "datasheet.pdf",
      contentLength: pdfBytes.byteLength,
      etag: second.etag
    });
    expect(first.etag).toMatch(/^"sha256-[A-Za-z0-9_-]+"$/);
  });

  it("rejects malformed stored PDF data", () => {
    expect(() =>
      buildBomItemDocumentPayload({
        id: "document_1",
        fileName: "datasheet.pdf",
        mimeType: "application/pdf",
        sizeBytes: pdfBytes.byteLength,
        dataUrl: "data:application/pdf;base64,%%%"
      })
    ).toThrow(/base64/);
  });

  it("keeps data URLs out of document metadata DTOs", () => {
    const metadata = bomItemDocumentMetadataSchema.parse({
      id: "document_1",
      itemId: "item_1",
      documentUrl: "/api/bom/items/documents/document_1",
      title: "Datasheet",
      fileName: "datasheet.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      createdAt: "2026-07-15T12:00:00.000Z",
      updatedAt: "2026-07-15T12:00:00.000Z"
    });

    expect(JSON.stringify(metadata)).not.toContain("data:application/pdf");
    expect(
      bomItemDocumentMetadataSchema.safeParse({ ...metadata, dataUrl: pdfDataUrl })
        .success
    ).toBe(false);
  });
});
