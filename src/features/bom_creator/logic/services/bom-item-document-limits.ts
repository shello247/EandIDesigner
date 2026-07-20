export const MAX_BOM_ITEM_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_BOM_ITEM_DOCUMENTS = 6;
export const MAX_BOM_ITEM_TOTAL_DOCUMENT_BYTES = 50 * 1024 * 1024;

export type BomItemDocumentViolationCode =
  | "count"
  | "individual_size"
  | "aggregate_size"
  | "mime_type"
  | "file_extension"
  | "signature"
  | "size_mismatch";

export type BomItemDocumentViolation = {
  code: BomItemDocumentViolationCode;
  message: string;
  documentIndex?: number;
};

export type BomItemDocumentBudgetEntry = {
  sizeBytes: number;
};

export type BomItemPdfValidationInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
};

export function validateBomItemDocumentBudget(
  documents: readonly BomItemDocumentBudgetEntry[]
) {
  const violations: BomItemDocumentViolation[] = [];
  const totalBytes = documents.reduce(
    (total, document) => total + document.sizeBytes,
    0
  );

  if (documents.length > MAX_BOM_ITEM_DOCUMENTS) {
    violations.push({
      code: "count",
      message: `Items can store up to ${MAX_BOM_ITEM_DOCUMENTS} PDF documents.`
    });
  }

  documents.forEach((document, documentIndex) => {
    if (
      !Number.isInteger(document.sizeBytes) ||
      document.sizeBytes <= 0 ||
      document.sizeBytes > MAX_BOM_ITEM_DOCUMENT_BYTES
    ) {
      violations.push({
        code: "individual_size",
        documentIndex,
        message: "Each PDF document must be 25 MB or smaller."
      });
    }
  });

  if (totalBytes > MAX_BOM_ITEM_TOTAL_DOCUMENT_BYTES) {
    violations.push({
      code: "aggregate_size",
      message: "PDF documents can use up to 50 MB per item."
    });
  }

  return { ok: violations.length === 0, totalBytes, violations };
}

export function validateBomItemPdf(input: BomItemPdfValidationInput) {
  const violations: BomItemDocumentViolation[] = [];
  const normalizedMimeType = input.mimeType.trim().toLowerCase();

  if (normalizedMimeType !== "application/pdf") {
    violations.push({
      code: "mime_type",
      message: "Only PDF documents are supported."
    });
  }

  if (!input.fileName.trim().toLowerCase().endsWith(".pdf")) {
    violations.push({
      code: "file_extension",
      message: "Document filenames must use the .pdf extension."
    });
  }

  if (input.bytes.byteLength !== input.sizeBytes) {
    violations.push({
      code: "size_mismatch",
      message: "Document size does not match the uploaded PDF data."
    });
  }

  const signature = String.fromCharCode(...input.bytes.slice(0, 5));
  if (signature !== "%PDF-") {
    violations.push({
      code: "signature",
      message: "The uploaded file does not contain a valid PDF signature."
    });
  }

  const budget = validateBomItemDocumentBudget([
    { sizeBytes: input.bytes.byteLength }
  ]);
  violations.push(...budget.violations);

  return {
    ok: violations.length === 0,
    actualSizeBytes: input.bytes.byteLength,
    violations
  };
}
