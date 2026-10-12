import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { attributeTypeDefinitionSchema, AttributeTypeError, type AttributeTypeOption } from "./type-schema";
import { rankAttributeTypes } from "../logic/services/attribute-applicability";
import { hashAttributeDefinition } from "./type-storage";

export async function getAttributeTypeRevisions(ids: string[], db: Prisma.TransactionClient = prisma) {
  if (ids.length > 4096) throw new AttributeTypeError("VALIDATION", "Too many type revisions in one operation.");
  const rows = await db.engineeringAttributeTypeRevision.findMany({ where: { id: { in: [...new Set(ids)] } }, include: { type: true } });
  return rows.map(row => {
    if (hashAttributeDefinition(row.definitionJson) !== row.contentHash) throw new AttributeTypeError("INTEGRITY", "Attribute type content has changed.");
    return { typeId: row.typeId, revisionId: row.id, revisionNumber: row.revisionNumber, currentRevision: row.type.currentRevision,
      analysisKey: row.type.analysisKey, definition: attributeTypeDefinitionSchema.parse(JSON.parse(row.definitionJson)), status: row.type.status as "active" | "retired" };
  });
}

export async function getAttributeTypeRevision(id: string, db: Prisma.TransactionClient = prisma): Promise<AttributeTypeOption> {
  const row = await db.engineeringAttributeTypeRevision.findUnique({ where: { id }, include: { type: true } });
  if (!row) throw new AttributeTypeError("NOT_FOUND", "Attribute type revision was not found.");
  if (hashAttributeDefinition(row.definitionJson) !== row.contentHash) throw new AttributeTypeError("INTEGRITY", "Attribute type content has changed.");
  return { typeId: row.typeId, revisionId: row.id, revisionNumber: row.revisionNumber,
    analysisKey: row.type.analysisKey, definition: attributeTypeDefinitionSchema.parse(JSON.parse(row.definitionJson)),
    status: row.type.status as "active" | "retired" };
}
export async function getCurrentAttributeType(typeId: string, db: Prisma.TransactionClient = prisma) {
  const type = await db.engineeringAttributeType.findUnique({ where: { id: z.string().min(1).parse(typeId) },
    include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } } });
  if (!type) throw new AttributeTypeError("NOT_FOUND", "Attribute type was not found.");
  return getAttributeTypeRevision(type.revisions[0].id, db);
}
export async function listAttributeTypes(input: unknown, db: Prisma.TransactionClient = prisma) {
  const query = z.object({ search: z.string().trim().max(160).default(""), page: z.number().int().positive().default(1),
    status: z.enum(["active", "retired"]).default("active"), deviceType: z.string().max(80).optional(),
    scope: z.enum(["device", "supply_input", "supply_output", "channel", "terminal"]).optional() }).parse(input);
  // One metadata read; source bytes and per-type queries are unnecessary for discovery.
  const rows = await db.engineeringAttributeType.findMany({ where: { status: query.status },
    include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } } });
  const types: AttributeTypeOption[] = rows.map(row => {
    const revision = row.revisions[0];
    if (!revision || hashAttributeDefinition(revision.definitionJson) !== revision.contentHash)
      throw new AttributeTypeError("INTEGRITY", "Attribute type content has changed.");
    return { typeId: row.id, revisionId: revision.id, revisionNumber: revision.revisionNumber, analysisKey: row.analysisKey,
      definition: attributeTypeDefinitionSchema.parse(JSON.parse(revision.definitionJson)), status: row.status as "active" | "retired" };
  });
  const ranked = rankAttributeTypes(types, query); const count = ranked.length;
  const page = Math.min(query.page, Math.max(1, Math.ceil(count / 25)));
  const items: AttributeTypeOption[] = ranked.slice((page - 1) * 25, page * 25);
  return { items, page, count, pages: Math.max(1, Math.ceil(count / 25)) };
}

export async function saveAttributeType(input: unknown, db: PrismaClient = prisma) {
  const parsed = z.strictObject({ typeId: z.string().optional(), expectedRevision: z.number().int().positive().optional(),
    definition: attributeTypeDefinitionSchema }).parse(input);
  try {
    return await db.$transaction(async tx => {
      const previous = parsed.typeId ? await tx.engineeringAttributeType.findUnique({ where: { id: parsed.typeId },
        include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } } }) : null;
      if (parsed.typeId && !previous) throw new AttributeTypeError("NOT_FOUND", "Attribute type was not found.");
      if (previous && (previous.status !== "active" || previous.currentRevision !== parsed.expectedRevision))
        throw new AttributeTypeError("REVISION_CONFLICT", "This type changed or was retired. Review its latest version.");
      if (previous) {
        const old = attributeTypeDefinitionSchema.parse(JSON.parse(previous.revisions[0].definitionJson));
        if (old.valueKind !== parsed.definition.valueKind || old.engineeringDimension !== parsed.definition.engineeringDimension ||
            old.payloadKind !== parsed.definition.payloadKind) throw new AttributeTypeError("VALIDATION", "Create a new type to change its value format or engineering dimension.");
      } else if (parsed.definition.payloadKind !== "scalar") throw new AttributeTypeError("VALIDATION", "Use the supplied conditional rating or terminal limit types.");
      const revisionNumber = (previous?.currentRevision ?? 0) + 1;
      const data = { name: parsed.definition.label, normalizedName: parsed.definition.label.toLowerCase(), currentRevision: revisionNumber };
      const type = previous ? await tx.engineeringAttributeType.update({ where: { id: previous.id }, data }) :
        await tx.engineeringAttributeType.create({ data });
      const definitionJson = JSON.stringify(parsed.definition);
      const revision = await tx.engineeringAttributeTypeRevision.create({ data: { typeId: type.id, revisionNumber,
        definitionJson, contentHash: hashAttributeDefinition(definitionJson) } });
      return getAttributeTypeRevision(revision.id, tx);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AttributeTypeError("VALIDATION", "An attribute type with this name already exists, or its revision changed.");
    throw error;
  }
}
export async function setAttributeTypeStatus(input: unknown, db: PrismaClient = prisma) {
  const parsed = z.strictObject({ typeId: z.string().min(1), expectedRevision: z.number().int().positive(),
    expectedStatus: z.enum(["active", "retired"]), status: z.enum(["active", "retired"]) }).parse(input);
  const result = await db.engineeringAttributeType.updateMany({ where: { id: parsed.typeId, currentRevision: parsed.expectedRevision,
    status: parsed.expectedStatus }, data: { status: parsed.status } });
  if (!result.count) throw new AttributeTypeError("REVISION_CONFLICT", "This type changed. Refresh the type list.");
  return { typeId: parsed.typeId, status: parsed.status };
}
