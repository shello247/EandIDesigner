import { z } from "zod";
import { itemProfileV3Schema, specificationEntrySchema } from "./profile-v3-schema";

export const specificationChangeSchema = specificationEntrySchema.omit({ type: true }).extend({ typeRevisionId: z.string().min(1) });
export const itemAttributeBatchSchema = z.strictObject({
  itemId: z.string().min(1), expectedLatestRevisionId: z.string().min(1).nullable(),
  additions: z.array(specificationChangeSchema).max(2048), updates: z.array(specificationChangeSchema).max(2048),
  removals: z.array(z.string().min(1)).max(2048),
  profile: z.strictObject({ deviceType: itemProfileV3Schema.shape.deviceType, groups: itemProfileV3Schema.shape.groups,
    modes: itemProfileV3Schema.shape.modes, channels: itemProfileV3Schema.shape.channels, terminals: itemProfileV3Schema.shape.terminals }).optional()
}).superRefine((batch, ctx) => {
  const seen = new Set<string>();
  for (const field of ["additions", "updates", "removals"] as const) batch[field].forEach((row, index) => {
    const id = typeof row === "string" ? row : row.id;
    if (seen.has(id)) ctx.addIssue({ code: "custom", path: [field, index], message: "Each specification may appear only once in a batch." });
    seen.add(id);
  });
});
export type ItemAttributeBatch = z.infer<typeof itemAttributeBatchSchema>;
