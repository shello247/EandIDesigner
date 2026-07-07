"use server";

import { revalidatePath } from "next/cache";
import {
  archiveSheetTemplate,
  createSheetTemplate
} from "../data/mutations";
import { getSheetTemplate, listSheetTemplates } from "../data/queries";
import type { SaveSheetTemplateInput } from "../data/schema";
import type {
  DrawingSheetTemplateDetail,
  DrawingSheetTemplateListItem,
  TemplateActionResult
} from "../types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

export async function saveSheetTemplateAction(
  input: SaveSheetTemplateInput
): Promise<TemplateActionResult<DrawingSheetTemplateDetail>> {
  try {
    const template = await createSheetTemplate(input);

    if (!template) {
      return { ok: false, error: "Sheet template could not be saved." };
    }

    revalidatePath("/drawings");
    return { ok: true, data: template };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function listSheetTemplatesAction(): Promise<
  TemplateActionResult<DrawingSheetTemplateListItem[]>
> {
  try {
    return { ok: true, data: await listSheetTemplates() };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function getSheetTemplateAction(
  templateId: string
): Promise<TemplateActionResult<DrawingSheetTemplateDetail>> {
  try {
    const template = await getSheetTemplate(templateId);

    if (!template) {
      return { ok: false, error: "Sheet template was not found." };
    }

    return { ok: true, data: template };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function archiveSheetTemplateAction(
  templateId: string
): Promise<TemplateActionResult<{ id: string }>> {
  try {
    await archiveSheetTemplate(templateId);
    revalidatePath("/drawings");
    return { ok: true, data: { id: templateId } };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
