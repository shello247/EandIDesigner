"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/features/symbol_registry/types";
import type { SvgImportPreview } from "../types";
import { saveImportedSvgSymbolDraft } from "../data/mutations";
import { svgSymbolImportDraftSchema } from "../data/schema";
import { parseImportedSvg } from "../logic/use_cases/parse-imported-svg";

const MAX_SVG_BYTES = 10 * 1024 * 1024;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function isSvgFile(file: File): boolean {
  return (
    file.type === "image/svg+xml" ||
    file.name.toLowerCase().endsWith(".svg")
  );
}

async function fileToText(file: File): Promise<string> {
  return Buffer.from(await file.arrayBuffer()).toString("utf8");
}

async function fileToSvgDataUrl(file: File): Promise<string> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function getFile(formData: FormData): File {
  const fileValue = formData.get("svgFile");

  if (
    !fileValue ||
    typeof fileValue !== "object" ||
    !("arrayBuffer" in fileValue)
  ) {
    throw new Error("Choose an SVG file to import.");
  }

  return fileValue as File;
}

export async function parseSvgImportPreviewAction(
  formData: FormData
): Promise<ActionResult<SvgImportPreview>> {
  try {
    const file = getFile(formData);

    if (file.size <= 0) {
      return { ok: false, error: "Choose an SVG file to import." };
    }

    if (file.size > MAX_SVG_BYTES) {
      return { ok: false, error: "SVG file must be 10 MB or smaller." };
    }

    if (!isSvgFile(file)) {
      return { ok: false, error: "Only SVG files are supported." };
    }

    const [rawSvg, dataUrl] = await Promise.all([
      fileToText(file),
      fileToSvgDataUrl(file)
    ]);
    const preview = parseImportedSvg({
      rawSvg,
      sourceAsset: {
        fileName: file.name || "imported-symbol.svg",
        mimeType: "image/svg+xml",
        sizeBytes: file.size,
        dataUrl
      }
    });

    return { ok: true, data: preview };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function saveImportedSvgSymbolAction(
  input: unknown
): Promise<ActionResult<NonNullable<Awaited<ReturnType<typeof saveImportedSvgSymbolDraft>>>>> {
  try {
    const parsed = svgSymbolImportDraftSchema.parse(input);
    const saved = await saveImportedSvgSymbolDraft(parsed);

    if (!saved) {
      return { ok: false, error: "Imported symbol could not be saved." };
    }

    revalidatePath("/symbols");
    revalidatePath(`/symbols/${saved.id}`);
    return { ok: true, data: saved };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

