import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ATTRIBUTE_TYPE_SEEDS } from "./type-seeds";

export const ATTRIBUTE_TYPE_STORAGE_SQL = [
  'CREATE TABLE IF NOT EXISTS "EngineeringAttributeType" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT \'active\', "analysisKey" TEXT, "currentRevision" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "EngineeringAttributeType_normalizedName_key" ON "EngineeringAttributeType"("normalizedName");',
  'CREATE UNIQUE INDEX IF NOT EXISTS "EngineeringAttributeType_analysisKey_key" ON "EngineeringAttributeType"("analysisKey");',
  'CREATE INDEX IF NOT EXISTS "EngineeringAttributeType_status_name_idx" ON "EngineeringAttributeType"("status", "name");',
  'CREATE TABLE IF NOT EXISTS "EngineeringAttributeTypeRevision" ("id" TEXT NOT NULL PRIMARY KEY, "typeId" TEXT NOT NULL, "revisionNumber" INTEGER NOT NULL, "definitionJson" TEXT NOT NULL, "contentHash" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EngineeringAttributeTypeRevision_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EngineeringAttributeType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "EngineeringAttributeTypeRevision_typeId_revisionNumber_key" ON "EngineeringAttributeTypeRevision"("typeId", "revisionNumber");',
  ...["UPDATE", "DELETE"].map(operation => `CREATE TRIGGER IF NOT EXISTS "EngineeringAttributeTypeRevision_immutable_${operation.toLowerCase()}" BEFORE ${operation} ON "EngineeringAttributeTypeRevision" BEGIN SELECT RAISE(ABORT, 'Attribute type revisions are immutable'); END`)
];
export const hashAttributeDefinition = (definitionJson: string) => createHash("sha256").update(definitionJson).digest("hex");
export async function seedAttributeTypes(db: Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "$executeRawUnsafe">) {
  for (const seed of ATTRIBUTE_TYPE_SEEDS) {
    const found = await db.$queryRawUnsafe<unknown[]>('SELECT id FROM "EngineeringAttributeType" WHERE id = ?', seed.typeId);
    if (found.length) continue;
    const definitionJson = JSON.stringify(seed.definition);
    await db.$executeRawUnsafe('INSERT INTO "EngineeringAttributeType" (id,name,normalizedName,analysisKey) VALUES(?,?,?,?)',
      seed.typeId, seed.definition.label, seed.definition.label.toLowerCase(), seed.analysisKey);
    await db.$executeRawUnsafe('INSERT INTO "EngineeringAttributeTypeRevision" (id,typeId,revisionNumber,definitionJson,contentHash) VALUES(?,?,1,?,?)',
      seed.revisionId, seed.typeId, definitionJson, hashAttributeDefinition(definitionJson));
  }
}
