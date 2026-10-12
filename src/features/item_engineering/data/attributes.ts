import { projectItemProfileV3 } from "../logic/services/profile-v3-adapter";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAttributeTypeRevision } from "@/features/engineering_attributes/api/server";
import { attributeTypeSnapshotSchema } from "@/features/engineering_attributes/api/public";
import { getLatestItemEngineeringRevision } from "./queries";
import { createItemEngineeringRevisionInTransaction } from "./mutations";
import { itemEngineeringDeviceTypeSchema } from "./schema";
import { attributePayloadSchema, itemAttributeEntrySchema, itemProfileV2Schema, type ItemProfileV2 } from "./attribute-schema";
import { projectItemAttributeProfile } from "../logic/services/item-attribute-profile";
import { ItemEngineeringError } from "../logic/services/item-engineering-revision";

const mutationBase = z.strictObject({ itemId: z.string().min(1), expectedLatestRevisionId: z.string().min(1).nullable() });
export const saveItemAttributeInputSchema = mutationBase.extend({
  entryId: z.string().min(1).optional(), typeRevisionId: z.string().min(1),
  title: itemAttributeEntrySchema.shape.title, description: itemAttributeEntrySchema.shape.description,
  groupKey: z.string().min(1).optional(),
  newGroup: z.strictObject({ label: z.string().trim().min(1).max(160), context: z.enum(["device", "supply_input", "supply_output"]) }).optional(),
  payload: attributePayloadSchema, source: itemAttributeEntrySchema.shape.source
}).refine(value => !!value.groupKey !== !!value.newGroup, "Choose an existing specification group or create one.");
export async function loadItemAttributeWorkspace(itemId: string, db: Prisma.TransactionClient = prisma) {
  const item = await db.bomItem.findUnique({ where: { id: z.string().min(1).parse(itemId) }, select: { displayName: true, status: true } });
  if (!item) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
  const latest = await getLatestItemEngineeringRevision(itemId, db);
  if(latest?.profile.version===3) throw new ItemEngineeringError("VALIDATION","This Item uses batch specifications. Reload the Engineering Attributes table to edit it.");
  return { itemName: item.displayName, status: item.status, revisionId: latest?.id ?? null,
    revisionNumber: latest?.revisionNumber ?? null, updatedAt: latest?.createdAt ?? null,
    profile: projectItemAttributeProfile(latest?.profile ?? null) };
}
async function mutateProfileInTransaction(base: z.infer<typeof mutationBase>, change: (profile: ItemProfileV2, tx: Prisma.TransactionClient) => Promise<void>, tx: Prisma.TransactionClient) {
  const current = await loadItemAttributeWorkspace(base.itemId, tx);
  if (current.status !== "active") throw new ItemEngineeringError("ARCHIVED", "Archived Items are read-only.");
  if (current.revisionId !== base.expectedLatestRevisionId) throw new ItemEngineeringError("REVISION_CONFLICT", "Item specifications changed. Compare the latest saved entry before retrying.");
  const profile = current.profile;
  await change(profile, tx);
  itemProfileV2Schema.parse(profile);
  const latest = await getLatestItemEngineeringRevision(base.itemId, tx);
  const [notes, documents] = latest ? [null, null] : await Promise.all([
    tx.bomItemEngineerNote.findMany({ where: { itemId: base.itemId, archivedAt: null }, select: { id: true } }),
    tx.bomItemDocument.findMany({ where: { itemId: base.itemId, archivedAt: null }, select: { id: true } })
  ]);
  await createItemEngineeringRevisionInTransaction({ itemId: base.itemId, expectedLatestRevisionId: base.expectedLatestRevisionId, profile,
    noteIds: latest?.noteIds ?? notes!.map(note => note.id), documentIds: latest?.documentIds ?? documents!.map(doc => doc.id) }, tx);
  return loadItemAttributeWorkspace(base.itemId, tx);
}
async function mutateProfile(base: z.infer<typeof mutationBase>, change: (profile: ItemProfileV2, tx: Prisma.TransactionClient) => Promise<void>, db: PrismaClient) {
  try {
    return await db.$transaction(tx => mutateProfileInTransaction(base, change, tx), { timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P1008", "P2028"].includes(error.code))
      throw new ItemEngineeringError("REVISION_CONFLICT", "Item data changed or is busy. Compare the latest revision and retry.");
    throw error;
  }
}
export async function saveItemAttribute(input: unknown, db: PrismaClient = prisma) {
  const parsed = saveItemAttributeInputSchema.parse(input);
  return mutateProfile(parsed, async (profile, tx) => {
    if (!await getLatestItemEngineeringRevision(parsed.itemId, tx)) {
      throw new ItemEngineeringError("VALIDATION", "Choose Device Type in Edit details before adding attributes.");
    }
    const old = parsed.entryId ? profile.entries.find(entry => entry.id === parsed.entryId) : undefined;
    if (parsed.entryId && !old) throw new ItemEngineeringError("NOT_FOUND", "This attribute was removed. Reload its latest revision.");
    const type = await getAttributeTypeRevision(parsed.typeRevisionId, tx);
    const retained = old?.type.revisionId === type.revisionId;
    if (type.status !== "active" && !retained) throw new ItemEngineeringError("VALIDATION", "This type was retired. Choose an active type.");
    if (!retained) {
      const current = await tx.engineeringAttributeType.findUniqueOrThrow({ where: { id: type.typeId } });
      if (current.currentRevision !== type.revisionNumber) throw new ItemEngineeringError("REVISION_CONFLICT", "This type changed. Select its current version.");
    }
    let groupKey = parsed.groupKey;
    if (parsed.newGroup) {
      groupKey = randomUUID();
      profile.groups.push({ key: groupKey, ...parsed.newGroup });
    }
    const entry = itemAttributeEntrySchema.parse({ id: old?.id ?? randomUUID(), groupKey, title: parsed.title, description: parsed.description,
      type: attributeTypeSnapshotSchema.parse({ typeId: type.typeId, revisionId: type.revisionId, revisionNumber: type.revisionNumber,
        analysisKey: type.analysisKey, definition: type.definition }), payload: parsed.payload, source: parsed.source });
    if (old) profile.entries[profile.entries.indexOf(old)] = entry; else profile.entries.push(entry);
  }, db);
}
export async function removeItemAttribute(input: unknown, db: PrismaClient = prisma) {
  const parsed = mutationBase.extend({ entryId: z.string().min(1) }).parse(input);
  return mutateProfile(parsed, async profile => {
    if (!profile.entries.some(entry => entry.id === parsed.entryId)) throw new ItemEngineeringError("NOT_FOUND", "Attribute was not found.");
    profile.entries = profile.entries.filter(entry => entry.id !== parsed.entryId);
  }, db);
}
export async function updateItemEngineeringClassification(input: unknown, db: PrismaClient = prisma) {
  const parsed = mutationBase.extend({ deviceType: itemEngineeringDeviceTypeSchema }).parse(input);
  const latest=await getLatestItemEngineeringRevision(parsed.itemId,db);
  if(latest?.profile.version===3)return db.$transaction(tx=>updateItemEngineeringClassificationInTransaction(parsed,tx));
  return mutateProfile(parsed, async profile => { profile.deviceType = parsed.deviceType; }, db);
}

// The caller owns this transaction when product identity and classification are
// saved together. One immutable revision captures both, or neither change commits.
export async function updateItemEngineeringClassificationInTransaction(input: unknown, tx: Prisma.TransactionClient) {
  const parsed = mutationBase.extend({ deviceType: itemEngineeringDeviceTypeSchema }).parse(input);
  const latest = await getLatestItemEngineeringRevision(parsed.itemId, tx);
  if (latest) {
    const result = await createItemEngineeringRevisionInTransaction({ itemId: parsed.itemId, expectedLatestRevisionId: parsed.expectedLatestRevisionId, profile: { ...projectItemProfileV3(latest.profile), deviceType: parsed.deviceType },
      noteIds: latest.noteIds, documentIds: latest.documentIds }, tx);
    return { revisionId: result.revision.id, profile: result.revision.profile };
  }
  return mutateProfileInTransaction(parsed, async profile => { profile.deviceType = parsed.deviceType; }, tx);
}
