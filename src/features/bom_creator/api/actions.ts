"use server";

import { revalidatePath } from "next/cache";
import {
  createBomItemCategory,
  createBomItemManufacturer,
  createBomItem,
  deleteBomItemDocument,
  deleteBomItem,
  saveSymbolBomTemplate,
  uploadBomItemDocument,
  updateBomItem
} from "../data/mutations";
import {
  getBomItemDetail,
  listBomItemFormOptions
} from "../data/queries";
import {
  getSymbolBomEditorData,
  listBomItemPickerRows,
  listExistingBomItemIds
} from "../data/symbol-bom-editor-queries";
import { saveSymbolBomTemplateInputSchema } from "../data/schema";
import type {
  BomItemDeleteResult,
  BomItemDetail,
  BomItemDocumentDeleteInput,
  BomItemDocumentMetadata,
  BomItemExtractionInput,
  BomItemExtractionResult,
  BomItemFormOptions,
  BomItemInput,
  BomItemOption,
  BomItemOptionInput,
  BomItemPickerInput,
  BomItemPickerResult,
  BomItemUpdateInput,
  SaveSymbolBomTemplateInput,
  SymbolBomEditorData,
  SymbolBomTemplateDetail
} from "../data/schema";
import {
  validateSymbolBomTemplateItemIds
} from "../logic/use_cases/symbol-bom-template-use-cases";
import { extractBomItemFromUrl } from "../logic/use_cases/extract-bom-item-from-url";
import {
  MAX_BOM_ITEM_DOCUMENT_BYTES,
  validateBomItemPdf
} from "../logic/services/bom-item-document-limits";
import type { ActionResult } from "../types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function revalidateBomOptionPaths() {
  revalidatePath("/bom");
  revalidatePath("/bom/items");
  revalidatePath("/symbols");
}

function revalidateBomPaths(input: { symbolId?: string; itemId?: string } = {}) {
  revalidatePath("/bom");
  revalidatePath("/bom/items");
  revalidatePath("/symbols");

  if (input.symbolId) {
    revalidatePath(`/symbols/${input.symbolId}`);
  }

  if (input.itemId) {
    revalidatePath(`/bom/items/${input.itemId}`);
  }
}

function formDataString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function documentTitleFromFileName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
}

export async function createBomItemCategoryAction(
  input: BomItemOptionInput
): Promise<ActionResult<BomItemOption>> {
  try {
    const option = await createBomItemCategory(input);
    revalidateBomOptionPaths();
    return { ok: true, data: option };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function createBomItemManufacturerAction(
  input: BomItemOptionInput
): Promise<ActionResult<BomItemOption>> {
  try {
    const option = await createBomItemManufacturer(input);
    revalidateBomOptionPaths();
    return { ok: true, data: option };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function createBomItemAction(
  input: BomItemInput
): Promise<ActionResult<BomItemDetail>> {
  try {
    const item = await createBomItem(input);

    if (!item) {
      return { ok: false, error: "BOM item could not be created." };
    }

    revalidateBomPaths({ itemId: item.id });
    return { ok: true, data: item };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function extractBomItemFromUrlAction(
  input: BomItemExtractionInput
): Promise<ActionResult<BomItemExtractionResult>> {
  try {
    return { ok: true, data: await extractBomItemFromUrl(input) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function uploadBomItemDocumentAction(
  formData: FormData
): Promise<ActionResult<BomItemDocumentMetadata>> {
  try {
    const itemId = formDataString(formData, "itemId");
    const titleInput = formDataString(formData, "title");
    const fileValue = formData.get("documentFile");

    if (
      !fileValue ||
      typeof fileValue !== "object" ||
      !("arrayBuffer" in fileValue) ||
      !("name" in fileValue) ||
      !("size" in fileValue) ||
      !("type" in fileValue)
    ) {
      return { ok: false, error: "Choose a PDF document to upload." };
    }

    const file = fileValue as File;
    if (file.size <= 0) {
      return { ok: false, error: "Choose a PDF document to upload." };
    }
    if (file.size > MAX_BOM_ITEM_DOCUMENT_BYTES) {
      return { ok: false, error: "Each PDF document must be 25 MB or smaller." };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateBomItemPdf({
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      sizeBytes: file.size,
      bytes: buffer
    });

    if (!validation.ok) {
      return {
        ok: false,
        error: validation.violations[0]?.message ?? "PDF document is invalid."
      };
    }

    const document = await uploadBomItemDocument({
      itemId,
      title: titleInput || documentTitleFromFileName(file.name) || "Document",
      fileName: file.name,
      mimeType: "application/pdf",
      sizeBytes: buffer.byteLength,
      dataUrl: `data:application/pdf;base64,${buffer.toString("base64")}`
    });

    if (!document) {
      return { ok: false, error: "BOM item document could not be uploaded." };
    }

    revalidateBomPaths({ itemId: document.itemId });
    return { ok: true, data: document };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteBomItemDocumentAction(
  input: BomItemDocumentDeleteInput
): Promise<ActionResult<{ id: string; itemId: string }>> {
  try {
    const document = await deleteBomItemDocument(input);
    revalidateBomPaths({ itemId: document.itemId });
    return { ok: true, data: document };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function updateBomItemAction(
  input: BomItemUpdateInput
): Promise<ActionResult<BomItemDetail>> {
  try {
    const item = await updateBomItem(input);

    if (!item) {
      return { ok: false, error: "BOM item could not be updated." };
    }

    revalidateBomPaths({ itemId: item.id });
    return { ok: true, data: item };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function getBomItemDetailAction(
  id: string
): Promise<ActionResult<BomItemDetail | null>> {
  try {
    const item = await getBomItemDetail(id);
    return { ok: true, data: item };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function getBomItemFormOptionsAction(): Promise<
  ActionResult<BomItemFormOptions>
> {
  try {
    return { ok: true, data: await listBomItemFormOptions() };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function getSymbolBomEditorDataAction(
  symbolId: string
): Promise<ActionResult<SymbolBomEditorData>> {
  try {
    return { ok: true, data: await getSymbolBomEditorData(symbolId) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function searchBomItemPickerAction(
  input: BomItemPickerInput
): Promise<ActionResult<BomItemPickerResult>> {
  try {
    return { ok: true, data: await listBomItemPickerRows(input) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteBomItemAction(
  id: string
): Promise<ActionResult<BomItemDeleteResult>> {
  try {
    const result = await deleteBomItem(id);

    revalidateBomPaths({ itemId: result.id });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function saveSymbolBomTemplateAction(
  input: SaveSymbolBomTemplateInput
): Promise<ActionResult<SymbolBomTemplateDetail | null>> {
  try {
    const candidate = saveSymbolBomTemplateInputSchema.parse(input);
    const itemIds = await listExistingBomItemIds(
      candidate.lines.map((line) => line.itemId)
    );
    const parsed = validateSymbolBomTemplateItemIds(candidate, itemIds);
    const template = await saveSymbolBomTemplate(parsed);

    revalidateBomPaths({ symbolId: parsed.symbolId });
    return { ok: true, data: template };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
