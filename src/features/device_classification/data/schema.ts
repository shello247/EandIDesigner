import { z } from "zod";
import { deviceTypeSchema } from "@/shared/device-classification/device-types";

const id = z.string().trim().min(1).max(160);
export const classificationBatchInputSchema = z.strictObject({
  symbolVersionIds: z.array(id).max(500),
  itemRevisionIds: z.array(id).max(500)
});
export const saveSymbolClassificationInputSchema = z.strictObject({
  versionId: id,
  expectedToken: z.string().regex(/^[a-f0-9]{64}$/),
  deviceType: deviceTypeSchema,
  evidence: z.string().trim().min(1, "Record the classification evidence.").max(2000)
});
export type ClassificationBatchInput = z.infer<typeof classificationBatchInputSchema>;
export type SaveSymbolClassificationInput = z.infer<typeof saveSymbolClassificationInputSchema>;
