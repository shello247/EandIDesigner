"use server";

import { revalidatePath } from "next/cache";
import {
  approveSymbolVersion,
  archiveSymbol,
  createEngineerNote,
  deleteSymbol,
  exportSymbolPackage,
  saveSymbolDraft,
  updateSymbolLayoutMetadata,
  updateSymbolTerminalMap,
  uploadSymbolDocument,
  validateSymbolVersion
} from "../data/mutations";
import {
  getSymbolDetail,
  getSymbolVersionForTerminalVerification,
  listSymbols
} from "../data/queries";
import type {
  SaveSymbolDraftInput,
  SymbolLayoutMetadataUpdateInput,
  TerminalMapUpdateInput
} from "../data/schema";
import { verifyTerminalMapWithAi } from "../logic/services/openai-terminal-map-verifier";
import type { ActionResult, SymbolDetail, SymbolListItem } from "../types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

const MAX_NOTE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function fileToDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = file.type || "application/octet-stream";

  return `data:${mimeType};base64,${base64}`;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").trim() || fileName;
}

export async function listSymbolsAction(): Promise<
  ActionResult<SymbolListItem[]>
> {
  try {
    return { ok: true, data: await listSymbols() };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function getSymbolAction(
  id: string
): Promise<ActionResult<SymbolDetail | null>> {
  try {
    return { ok: true, data: await getSymbolDetail(id) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function saveSymbolDraftAction(
  input: SaveSymbolDraftInput
): Promise<ActionResult<SymbolDetail>> {
  try {
    const saved = await saveSymbolDraft(input);
    if (!saved) {
      return { ok: false, error: "Symbol draft could not be saved." };
    }
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${saved.id}`);
    return { ok: true, data: saved };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function validateSymbolAction(
  versionId: string
): Promise<ActionResult<{ symbolId: string; blockingIssueCount: number }>> {
  try {
    const result = await validateSymbolVersion(versionId);
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${result.symbolId}`);
    return {
      ok: true,
      data: {
        symbolId: result.symbolId,
        blockingIssueCount: result.blockingIssueCount
      }
    };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function updateSymbolTerminalMapAction(
  input: TerminalMapUpdateInput
): Promise<ActionResult<SymbolDetail>> {
  try {
    const updated = await updateSymbolTerminalMap(input);
    if (!updated) {
      return { ok: false, error: "Terminal map could not be updated." };
    }
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${updated.id}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function updateSymbolLayoutMetadataAction(
  input: SymbolLayoutMetadataUpdateInput
): Promise<ActionResult<SymbolDetail>> {
  try {
    const updated = await updateSymbolLayoutMetadata(input);
    if (!updated) {
      return { ok: false, error: "Layout metadata could not be updated." };
    }
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${updated.id}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function verifyTerminalMapWithAiAction(
  versionId: string
): Promise<ActionResult<Awaited<ReturnType<typeof verifyTerminalMapWithAi>>>> {
  try {
    const input = await getSymbolVersionForTerminalVerification(versionId);

    if (!input) {
      return { ok: false, error: "Symbol version was not found." };
    }

    return { ok: true, data: await verifyTerminalMapWithAi(input) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function createEngineerNoteAction(
  formData: FormData
): Promise<ActionResult<SymbolDetail>> {
  try {
    const symbolId = getString(formData, "symbolId");
    const versionId = getString(formData, "versionId") || undefined;
    const notes = getString(formData, "notes");
    const imageDataUrl = getString(formData, "imageDataUrl");
    const imageFileName = getString(formData, "imageFileName");
    const imageMimeType = getString(formData, "imageMimeType");
    const imageSizeBytesValue = Number(getString(formData, "imageSizeBytes"));

    if (imageDataUrl && !imageDataUrl.startsWith("data:image/")) {
      return { ok: false, error: "Engineer note image must be an image file." };
    }

    if (imageSizeBytesValue > MAX_NOTE_IMAGE_BYTES) {
      return { ok: false, error: "Engineer note image must be 10 MB or smaller." };
    }

    const saved = await createEngineerNote({
      symbolId,
      versionId,
      notes,
      image: imageDataUrl
        ? {
            fileName: imageFileName || "pasted-image.png",
            mimeType: imageMimeType || "image/png",
            sizeBytes: Number.isFinite(imageSizeBytesValue)
              ? imageSizeBytesValue
              : 0,
            dataUrl: imageDataUrl
          }
        : undefined
    });

    if (!saved) {
      return { ok: false, error: "Engineer note could not be saved." };
    }

    revalidatePath("/symbols");
    revalidatePath(`/symbols/${saved.id}`);
    return { ok: true, data: saved };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function uploadSymbolDocumentAction(
  formData: FormData
): Promise<ActionResult<{ symbolId: string; documentId: string }>> {
  try {
    const symbolId = getString(formData, "symbolId");
    const versionId = getString(formData, "versionId") || undefined;
    const titleInput = getString(formData, "title");
    const fileValue = formData.get("documentFile");

    if (
      !fileValue ||
      typeof fileValue !== "object" ||
      !("arrayBuffer" in fileValue)
    ) {
      return { ok: false, error: "Choose a PDF document to upload." };
    }

    const file = fileValue as File;

    if (file.size <= 0) {
      return { ok: false, error: "Choose a PDF document to upload." };
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      return { ok: false, error: "PDF document must be 25 MB or smaller." };
    }

    if (!isPdfFile(file)) {
      return { ok: false, error: "Only PDF documents are supported." };
    }

    const saved = await uploadSymbolDocument({
      symbolId,
      versionId,
      title: titleInput || titleFromFileName(file.name),
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      sizeBytes: file.size,
      dataUrl: await fileToDataUrl(file)
    });

    if (!saved) {
      return { ok: false, error: "Document could not be uploaded." };
    }

    revalidatePath("/symbols");
    revalidatePath(`/symbols/${saved.symbolId}`);
    return {
      ok: true,
      data: { symbolId: saved.symbolId, documentId: saved.id }
    };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function approveSymbolAction(
  versionId: string
): Promise<ActionResult<SymbolDetail>> {
  try {
    const approved = await approveSymbolVersion(versionId);
    if (!approved) {
      return { ok: false, error: "Symbol version could not be approved." };
    }
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${approved.id}`);
    return { ok: true, data: approved };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function archiveSymbolAction(
  symbolId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await archiveSymbol(symbolId);
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${symbolId}`);
    return { ok: true, data: { id: symbolId } };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteSymbolAction(
  symbolId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await deleteSymbol(symbolId);
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${symbolId}`);
    return { ok: true, data: { id: symbolId } };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function exportSymbolPackageAction(
  symbolId: string
): Promise<ActionResult<Awaited<ReturnType<typeof exportSymbolPackage>>>> {
  try {
    return { ok: true, data: await exportSymbolPackage(symbolId) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
