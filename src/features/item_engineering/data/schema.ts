import { z } from "zod";
import { deviceTypeSchema } from "@/shared/device-classification/device-types";
import { itemProfileV3Schema } from "./profile-v3-schema";
import { itemProfileV2Schema } from "./attribute-schema";
import {
  engineeringAttributeContainerSchema,
  engineeringAttributeSourceSchema,
  validateEngineeringAttributeValue
} from "@/features/engineering_attributes/api/public";

const keySchema = z.string().trim().min(1).max(160);

export const itemEngineeringDeviceTypeSchema = deviceTypeSchema;

export const itemSpecificationContextSchema = z.enum([
  "device", "supply_input", "supply_output"
]);

export const itemSpecificationGroupSchema = z.strictObject({
  key: keySchema,
  label: z.string().trim().min(1).max(160),
  context: itemSpecificationContextSchema,
  attributes: engineeringAttributeContainerSchema
});

export const terminalConductorRangeSchema = z.strictObject({
  key: keySchema,
  terminalKeys: z.array(keySchema).min(1).max(256),
  conductorClass: z.enum(["solid", "stranded", "fine_stranded"]),
  termination: z.enum(["bare", "ferruled"]),
  minimumMm2: z.number().finite().positive(),
  maximumMm2: z.number().finite().positive(),
  maximumConductors: z.number().int().positive().max(32),
  source: engineeringAttributeSourceSchema
}).superRefine((range, ctx) => {
  if (range.minimumMm2 > range.maximumMm2) {
    ctx.addIssue({ code: "custom", path: ["maximumMm2"],
      message: "Maximum conductor area must be at least the minimum area." });
  }
  if (new Set(range.terminalKeys).size !== range.terminalKeys.length) {
    ctx.addIssue({ code: "custom", path: ["terminalKeys"],
      message: "Each terminal may appear only once in a conductor range." });
  }
});

export const itemShortCircuitRatingSchema = z.strictObject({
  key: keySchema,
  groupKey: keySchema,
  ratingType: z.enum(["sccr", "breaking_capacity"]),
  designation: z.string().trim().min(1).max(160),
  currentKa: z.number().finite().positive(),
  voltageV: z.number().finite().positive(),
  supplyNature: z.enum(["ac", "dc"]),
  conditions: z.string().trim().min(1).max(2000),
  source: engineeringAttributeSourceSchema.extend({
    reference: z.string().trim().min(1).max(500)
  })
});

export const itemEngineeringProfileV1Schema = z.strictObject({
  version: z.literal(1),
  deviceType: itemEngineeringDeviceTypeSchema,
  groups: z.array(itemSpecificationGroupSchema).max(32),
  terminalConductorRanges: z.array(terminalConductorRangeSchema).max(256),
  shortCircuitRatings: z.array(itemShortCircuitRatingSchema).max(64).default([])
}).superRefine((profile, ctx) => {
  for (const collection of ["groups", "terminalConductorRanges", "shortCircuitRatings"] as const) {
    const keys = new Set<string>();
    profile[collection].forEach((entry, index) => {
      if (keys.has(entry.key)) {
        ctx.addIssue({ code: "custom", path: [collection, index, "key"],
          message: "Each entry must have a unique key." });
      }
      keys.add(entry.key);
    });
  }
  const groupKeys = new Set(profile.groups.map((group) => group.key));
  profile.shortCircuitRatings.forEach((rating, index) => {
    if (!groupKeys.has(rating.groupKey)) {
      ctx.addIssue({ code: "custom", path: ["shortCircuitRatings", index, "groupKey"],
        message: "A short-circuit rating must reference an existing specification group." });
    }
  });
  profile.groups.forEach((group, groupIndex) => {
    group.attributes.values.forEach((value, valueIndex) => {
      for (const issue of validateEngineeringAttributeValue({
        value, subject: { kind: "item", typeToken: profile.deviceType }
      })) {
        ctx.addIssue({
          code: "custom",
          path: ["groups", groupIndex, "attributes", "values", valueIndex],
          message: issue.message
        });
      }
    });
  });
});

export const itemEngineeringProfileSchema = z.union([itemEngineeringProfileV1Schema, itemProfileV2Schema, itemProfileV3Schema]);

// Missing selection remains a legacy model concern, not an implicit product choice.
export const itemSelectionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    version: z.literal(1),
    status: z.literal("unassigned"),
    configurationId: keySchema
  }),
  z.strictObject({
    version: z.literal(1),
    status: z.literal("selected"),
    configurationId: keySchema,
    itemId: keySchema,
    itemEngineeringRevisionId: keySchema
  })
]);

export type ItemEngineeringProfile = z.infer<typeof itemEngineeringProfileSchema>;
export type ItemSpecificationContext = z.infer<typeof itemSpecificationContextSchema>;
export type ItemSelection = z.infer<typeof itemSelectionSchema>;
export type TerminalConductorRange = z.infer<typeof terminalConductorRangeSchema>;

export const itemEngineeringRevisionSchema = z.strictObject({
  id: keySchema,
  itemId: keySchema,
  revisionNumber: z.number().int().positive(),
  identity: z.strictObject({
    itemKey: keySchema,
    displayName: z.string().trim().min(1).max(240),
    manufacturer: z.string().trim().max(240).nullable(),
    model: z.string().trim().max(240).nullable(),
    partNumber: z.string().trim().max(240).nullable()
  }),
  profile: itemEngineeringProfileSchema,
  noteIds: z.array(keySchema).max(128),
  documentIds: z.array(keySchema).max(128),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime()
}).superRefine((revision, ctx) => {
  for (const field of ["noteIds", "documentIds"] as const) {
    if (new Set(revision[field]).size !== revision[field].length) {
      ctx.addIssue({ code: "custom", path: [field], message: "Duplicate guidance reference." });
    }
  }
});

export const symbolItemConfigurationSchema = z.strictObject({
  id: keySchema,
  symbolVersionId: keySchema,
  revisionNumber: z.number().int().positive(),
  symbolContractHash: z.string().regex(/^[a-f0-9]{64}$/),
  options: z.array(z.strictObject({
    itemId: keySchema,
    itemEngineeringRevisionId: keySchema,
    usage: z.enum(["schematic", "panel_layout"]),
    evidence: z.string().trim().min(1).max(2000)
  })).min(1).max(1000)
}).superRefine((configuration, ctx) => {
  const options = new Set<string>();
  configuration.options.forEach((option, index) => {
    const key = option.itemEngineeringRevisionId;
    if (options.has(key)) {
      ctx.addIssue({ code: "custom", path: ["options", index],
        message: "A product revision must appear only once in a configuration." });
    }
    options.add(key);
  });
});

export const saveItemEngineeringRevisionInputSchema = z.strictObject({
  itemId: keySchema,
  expectedLatestRevisionId: keySchema.nullable(),
  profile: itemEngineeringProfileSchema,
  noteIds: z.array(keySchema).max(128),
  documentIds: z.array(keySchema).max(128)
}).superRefine((input, ctx) => {
  for (const field of ["noteIds", "documentIds"] as const) {
    if (new Set(input[field]).size !== input[field].length) {
      ctx.addIssue({ code: "custom", path: [field], message: "Duplicate guidance reference." });
    }
  }
});

export type ItemEngineeringRevision = z.infer<typeof itemEngineeringRevisionSchema>;
export type SaveItemEngineeringRevisionInput = z.infer<typeof saveItemEngineeringRevisionInputSchema>;

export const ITEM_NOTE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ITEM_NOTE_MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
export const ITEM_NOTE_MAX_ACTIVE = 128;
export const itemEngineerNoteImageSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sizeBytes: z.number().int().positive().max(ITEM_NOTE_MAX_IMAGE_BYTES),
  dataUrl: z.string().max(Math.ceil(ITEM_NOTE_MAX_IMAGE_BYTES / 3) * 4 + 128)
});
export const saveItemEngineerNoteInputSchema = z.strictObject({
  itemId: keySchema,
  expectedLatestRevisionId: keySchema.nullable(),
  replaceNoteId: keySchema.optional(),
  notes: z.string().trim().max(20_000),
  image: itemEngineerNoteImageSchema.nullable()
}).refine(value => value.notes.length > 0 || value.image !== null, {
  path: ["notes"], message: "Paste an image or enter some text."
});
export const archiveItemEngineerNoteInputSchema = z.strictObject({
  itemId: keySchema, noteId: keySchema, expectedLatestRevisionId: keySchema.nullable()
});
export const reorderItemEngineerNoteInputSchema = z.strictObject({
  itemId: keySchema, noteId: keySchema, beforeNoteId: keySchema.nullable(),
  expectedOrderToken: z.string().regex(/^[a-f0-9]{64}$/),
  expectedLatestRevisionId: keySchema.nullable()
});
export const itemEngineerNoteMetadataSchema = z.strictObject({
  id: keySchema, itemId: keySchema, notes: z.string().max(20_000),
  hasImage: z.boolean(), supersedesId: keySchema.nullable(),
  createdAt: z.iso.datetime(), archivedAt: z.iso.datetime().nullable()
});
export const itemEngineerNoteDetailSchema = itemEngineerNoteMetadataSchema.extend({
  image: itemEngineerNoteImageSchema.nullable()
});
export const itemEngineerNotePageInputSchema = z.strictObject({
  itemId: keySchema, page: z.number().int().positive().max(1_000_000).default(1),
  focusNoteId: keySchema.optional(),
  includeArchived: z.boolean().default(false)
});
export type SaveItemEngineerNoteInput = z.infer<typeof saveItemEngineerNoteInputSchema>;
export type ItemEngineerNoteMetadata = z.infer<typeof itemEngineerNoteMetadataSchema>;
