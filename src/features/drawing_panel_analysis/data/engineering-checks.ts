import {z} from "zod";
import {attributeEvidenceSchema} from "@/features/item_engineering/api/public";

export const ioScheduleRowSchema=z.object({
  id:z.string(),physicalKey:z.string(),assetId:z.string(),assetLabel:z.string(),itemId:z.string(),revisionId:z.string(),revisionNumber:z.number(),product:z.string(),partNumber:z.string().nullable(),
  channelId:z.string().nullable(),channelNumber:z.string().nullable(),direction:z.string(),signalType:z.string(),range:z.string(),modes:z.array(z.string()),
  terminalId:z.string().nullable(),terminalNumber:z.string().nullable(),terminalFunction:z.string(),terminalRole:z.string(),connectable:z.boolean(),isolationGroup:z.string().optional(),symbolTerminalKey:z.string().optional(),
  connections:z.array(z.object({id:z.string(),label:z.string()})),evidence:z.array(attributeEvidenceSchema),notes:z.array(z.string())
});
export type IoScheduleRow=z.infer<typeof ioScheduleRowSchema>;
export const powerBudgetSchema=z.object({
  id:z.string(),supplyKey:z.string(),supplyAssetId:z.string(),supplyLabel:z.string(),outputId:z.string(),unit:z.enum(["W","VA","A"]),
  capacity:z.number().finite().nonnegative().optional(),knownSubtotal:z.number().finite().nonnegative(),remainingCapacity:z.number().finite().optional(),
  status:z.enum(["verified","provisional","insufficient","incompatible","exceeded"]),coverage:z.enum(["complete","partial"]),provisional:z.boolean(),
  reasons:z.array(z.string()),loads:z.array(z.object({key:z.string(),assetId:z.string(),label:z.string(),value:z.number().finite().nonnegative().optional(),provisional:z.boolean(),reasons:z.array(z.string())}))
});
export const powerAnalysisSchema=z.object({budgets:z.array(powerBudgetSchema),unassigned:z.array(z.object({key:z.string(),assetId:z.string(),label:z.string(),reason:z.string()}))});
export type PowerBudget=z.infer<typeof powerBudgetSchema>;
export type PowerAnalysis=z.infer<typeof powerAnalysisSchema>;
