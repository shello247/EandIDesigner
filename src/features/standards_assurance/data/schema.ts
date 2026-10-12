import { z } from "zod";

const text = (max = 4000) => z.string().trim().max(max);
const required = (max = 4000) => text(max).min(1, "This field is required.");
export const idSchema = required(140);
export const localReviewNotice = "Local Review — Identity Not Authenticated";
export const provenanceNotice = "Declared evidence — not a trusted automated verification";
export const entityKindSchema = z.enum(["reference", "requirement", "implementation", "profile"]);
export const lifecycleSchema = z.enum(["active", "retired"]);
export const safeUrlSchema = z.union([z.literal(""), z.url().max(2000).refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS source link.")]);
export const referenceSchema = z.strictObject({
  title: required(240), kind: z.enum(["international_standard", "client_specification", "manufacturer_instruction", "company_procedure"]),
  publisher: required(160), designation: required(160), edition: required(160), amendment: text(160),
  subject: required(), sourceUrl: safeUrlSchema, access: z.enum(["catalogue_only", "full_source"]),
  materialExamined: text(), rightsNotes: text(), status: lifecycleSchema
}).superRefine((value, ctx) => {
  if (value.access === "full_source" && !value.materialExamined) ctx.addIssue({ code: "custom", path: ["materialExamined"], message: "Identify the authoritative material examined." });
});
export const requirementSchema = z.strictObject({
  title: required(240), sourceRevisionId: idSchema, locator: text(500),
  sourceStatus: z.enum(["candidate", "source_checked"]), explanation: required(), interpretation: text(),
  applicability: required(), exclusions: text(), expectedBehavior: required(), owner: text(160),
  verificationMethod: z.enum(["automated", "manual", "combined"]), status: lifecycleSchema
}).superRefine((value, ctx) => {
  if (value.sourceStatus === "source_checked" && !value.locator) ctx.addIssue({ code: "custom", path: ["locator"], message: "A source-checked requirement needs a clause, table or entry reference." });
});
export const implementationSchema = z.strictObject({
  title: required(240), requirementRevisionId: idSchema,
  implementationStatus: z.enum(["not_planned", "planned", "implemented"]),
  behavior: required(), whereToSee: text(), verificationPlan: required(), limitations: text(),
  controls: z.array(z.strictObject({ title: required(200), description: required() })).max(40),
  technicalReferences: z.array(required(1000)).max(40), status: lifecycleSchema
});
export const profileEntrySchema = z.strictObject({
  requirementRevisionId: idSchema, implementationRevisionId: idSchema.nullable(),
  applicability: z.enum(["applies", "excluded", "unresolved"]), rationale: text(), conflict: text()
}).superRefine((value, ctx) => {
  if (value.applicability !== "applies" && !value.rationale) ctx.addIssue({ code: "custom", path: ["rationale"], message: "Explain exclusions and unresolved applicability." });
  if (value.conflict && value.applicability !== "unresolved") ctx.addIssue({ code: "custom", path: ["applicability"], message: "Conflicting requirements must remain unresolved." });
});
export const profileSchema = z.strictObject({
  title: required(240), purpose: required(), scope: required(), clientReference: text(240), projectReference: text(240),
  entries: z.array(profileEntrySchema).max(250), status: lifecycleSchema
}).superRefine((value, ctx) => {
  if (new Set(value.entries.map(entry => entry.requirementRevisionId)).size !== value.entries.length) ctx.addIssue({ code: "custom", path: ["entries"], message: "A requirement revision can occur only once in a profile." });
});
const saveBase = { entityId: idSchema.nullable(), expectedRevisionId: idSchema.nullable(), operationId: z.uuid() };
export const saveContentSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...saveBase, kind: z.literal("reference"), content: referenceSchema }),
  z.strictObject({ ...saveBase, kind: z.literal("requirement"), content: requirementSchema }),
  z.strictObject({ ...saveBase, kind: z.literal("implementation"), content: implementationSchema }),
  z.strictObject({ ...saveBase, kind: z.literal("profile"), content: profileSchema })
]);
export const evidenceSchema = z.strictObject({
  operationId: z.uuid(), requirementRevisionId: idSchema, implementationRevisionId: idSchema.nullable(),
  type: z.enum(["manual_check", "test_report", "example"]), description: required(), result: z.enum(["pass", "fail", "inconclusive"]),
  artifactReference: text(2000), buildId: text(200), producer: required(160),
  recordedAt: z.iso.datetime(), notes: text()
}).superRefine((value, ctx) => {
  if (value.type === "test_report" && (!value.buildId || !value.artifactReference)) ctx.addIssue({ code: "custom", path: ["buildId"], message: "Test reports need a build identity and report reference." });
});
export const reviewSchema = z.strictObject({
  operationId: z.uuid(), targetKind: z.enum(["requirement", "implementation", "profile"]), targetRevisionId: idSchema,
  reviewer: required(160), reviewedAt: z.iso.datetime(), outcome: z.enum(["review_recorded", "changes_requested"]),
  comments: required(), evidenceIds: z.array(idSchema).max(100)
});
export const snapshotInputSchema = z.strictObject({
  operationId: z.uuid(), profileRevisionId: idSchema, expectedCurrentRevisionId: idSchema, expectedAssessmentHash: z.string().regex(/^[a-f0-9]{64}$/)
});
export const listInputSchema = z.strictObject({
  kind: entityKindSchema, query: text(200).default(""), page: z.number().int().min(1).max(100000).default(1),
  status: z.enum(["all", "active", "retired"]).default("active")
});
export const payloadSchemas = { reference: referenceSchema, requirement: requirementSchema, implementation: implementationSchema, profile: profileSchema };
export type EntityKind = z.infer<typeof entityKindSchema>;
export type ContentByKind = {
  reference: z.infer<typeof referenceSchema>; requirement: z.infer<typeof requirementSchema>;
  implementation: z.infer<typeof implementationSchema>; profile: z.infer<typeof profileSchema>;
};
export type SaveContentInput = z.infer<typeof saveContentSchema>;
export type EvidenceInput = z.infer<typeof evidenceSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ProfileEntry = z.infer<typeof profileEntrySchema>;
