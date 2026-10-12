import { z } from "zod";
import {specificationScopeSchema} from "./profile-v3-schema";

const key = z.string().trim().min(1).max(160);
export const productInterfaceSchema = z.strictObject({
  terminalMappings: z.array(z.strictObject({ terminalId: key, symbolTerminalKey: key })).max(2048).default([])
}).superRefine((value,ctx) => {
  for (const field of ["terminalId","symbolTerminalKey"] as const)
    if (new Set(value.terminalMappings.map(m => m[field])).size !== value.terminalMappings.length)
      ctx.addIssue({code:"custom",path:["terminalMappings"],message:"Each product terminal and Symbol terminal must be mapped only once."});
});
export const compatibleProductSchema = z.strictObject({
  itemId: key, itemEngineeringRevisionId: key, usage: z.enum(["wiring","panel_layout","both"]),
  evidence: z.string().trim().min(1).max(2000), interface: productInterfaceSchema
});
export const additionalProductPartSchema = z.strictObject({
  lineKey: key, itemEngineeringRevisionId: key, optionRevisionId: key.nullable(),
  quantityRule: z.enum(["fixed_per_assembly","per_cable_end","per_conductor_termination","per_connection","manual"]), quantity: z.number().finite().positive().max(1000000)
});
export const productConfigurationSchema = z.strictObject({
  id: key, symbolVersionId: key, revisionNumber: z.number().int().positive(),
  symbolContractHash: z.string().regex(/^[a-f0-9]{64}$/),
  options: z.array(compatibleProductSchema).min(1).max(1000), parts: z.array(additionalProductPartSchema).max(1000)
}).superRefine((v,ctx) => {
  if (new Set(v.options.map(o => o.itemEngineeringRevisionId)).size !== v.options.length)
    ctx.addIssue({code:"custom",path:["options"],message:"A product revision may appear only once."});
  if (new Set(v.parts.map(p => p.lineKey)).size !== v.parts.length)
    ctx.addIssue({code:"custom",path:["parts"],message:"Additional part identities must be unique."});
  v.parts.forEach((p,i) => {
    if (p.optionRevisionId && !v.options.some(o => o.itemEngineeringRevisionId === p.optionRevisionId))
      ctx.addIssue({code:"custom",path:["parts",i],message:"Additional part must reference a configured option."});
    if (p.optionRevisionId === p.itemEngineeringRevisionId || !p.optionRevisionId && v.options.some(o => o.itemEngineeringRevisionId === p.itemEngineeringRevisionId))
      ctx.addIssue({code:"custom",path:["parts",i],message:"The primary product is already counted; do not add it as an additional part."});
  });
});
export const saveProductConfigurationSchema = z.strictObject({
  symbolVersionId: key, expectedConfigurationId: key.nullable(),
  options: productConfigurationSchema.shape.options, parts: productConfigurationSchema.shape.parts
});
// Absent means legacy. Explicit unassigned removes ambiguity without guessing a product.
export const drawingProductSelectionSchema = z.discriminatedUnion("status",[
  z.strictObject({version:z.literal(1),status:z.literal("unassigned"),configurationId:key}),
  z.strictObject({version:z.literal(1),status:z.literal("selected"),configurationId:key,itemId:key,itemEngineeringRevisionId:key})
]);
export const physicalProductTargetSchema = z.strictObject({
  assetId:key, memberId:key.optional(), componentPath:z.array(key).max(16).default([])
});
export const engineeringProjectSettingsSchema = z.strictObject({
  terminalConnections:z.array(z.strictObject({terminalId:key,connectionId:key,
    conductorClass:z.enum(["solid","stranded","fine_stranded"]).optional(),
    termination:z.enum(["bare","ferruled"]).optional(),
    size:z.string().trim().max(80).optional()})).max(4096).optional(),
  confirmedConditions:z.array(key).max(2048).optional(),
  modes:z.array(z.strictObject({setId:key,choiceId:key})).max(16).default([]),
  assumptions:z.array(z.strictObject({id:key,analysisKey:key,scope:specificationScopeSchema.optional(),value:z.number().finite(),unit:key,reason:z.string().trim().min(1).max(2000)})).max(128).default([]),
  powerAssignment:z.strictObject({supply:physicalProductTargetSchema,outputId:key,loadInputId:key,supplyNature:z.enum(["ac","dc","unknown"]),voltageV:z.number().finite().positive().optional()}).optional(),
  channelRanges:z.array(z.strictObject({channelId:key,minimum:z.number().finite(),maximum:z.number().finite(),unit:key})).max(1024).default([])
}).superRefine((v,ctx) => {
  if(v.terminalConnections&&new Set(v.terminalConnections.map(t=>JSON.stringify([t.terminalId,t.connectionId]))).size!==v.terminalConnections.length)ctx.addIssue({code:"custom",path:["terminalConnections"],message:"A landed conductor may have one installation record per product terminal."});
  if(new Set(v.modes.map(m=>m.setId)).size!==v.modes.length) ctx.addIssue({code:"custom",path:["modes"],message:"Select one choice per operating mode."});
  if(new Set(v.channelRanges.map(r=>r.channelId)).size!==v.channelRanges.length) ctx.addIssue({code:"custom",path:["channelRanges"],message:"Select one range per channel."});
  v.channelRanges.forEach((r,i)=>{if(r.minimum>r.maximum)ctx.addIssue({code:"custom",path:["channelRanges",i],message:"Maximum must be at least minimum."});});
});
export type ProductInterface=z.infer<typeof productInterfaceSchema>;
export type CompatibleProduct=z.infer<typeof compatibleProductSchema>;
export type ProductConfiguration=z.infer<typeof productConfigurationSchema>;
export type AdditionalProductPart=z.infer<typeof additionalProductPartSchema>;
export type DrawingProductSelection=z.infer<typeof drawingProductSelectionSchema>;
export type PhysicalProductTarget=z.infer<typeof physicalProductTargetSchema>;
export type EngineeringProjectSettings=z.infer<typeof engineeringProjectSettingsSchema>;
