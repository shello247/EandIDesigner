import { z } from "zod";
import type { DrawingModel } from "../../data/schema";
import { addSectionTitlePage } from "../commands/drawing-sheet-commands";
import { buildDrawingSectionIndex } from "./drawing-sections";

export const newDrawingSectionSchema = z.object({
  title: z.string().trim().min(1, "Enter a section title.").max(160),
  name: z.string().trim().max(120).optional(),
  subtitle: z.string().trim().max(400).optional()
});

export const workingSheetDestinationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("existing"), sectionId: z.string().min(1, "Choose a section.") }),
  z.object({ kind: z.literal("new"), title: newDrawingSectionSchema.shape.title })
]);

export type WorkingSheetDestination = z.infer<typeof workingSheetDestinationSchema>;

/** Prepare only: the caller commits this and the new working sheet atomically. */
export function prepareWorkingSheetDestination(model: DrawingModel, input: unknown): {
  model: DrawingModel; sectionId: string; insertAt: number;
} {
  const parsed = workingSheetDestinationSchema.safeParse(input);
  if (!parsed.success) throw new Error("Choose an existing section or enter a title for a new section.");
  const destination = parsed.data;
  if (destination.kind === "new") {
    // Append, so no legacy leading sheets are silently adopted by a new section.
    const created = addSectionTitlePage(model, { title: destination.title });
    return { model: created.model, sectionId: created.sheetId, insertAt: created.model.sheets.length };
  }
  const section = buildDrawingSectionIndex(model).sections.find(s => s.id === destination.sectionId);
  if (!section) throw new Error("That section is no longer available. Choose another section.");
  return { model, sectionId: section.id, insertAt: section.endIndexExclusive };
}
