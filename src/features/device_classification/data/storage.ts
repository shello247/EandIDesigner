import type { PrismaClient } from "@prisma/client";

export const DEVICE_TYPE_INDEX_SQL = 'CREATE INDEX IF NOT EXISTS "SymbolVersion_deviceType_idx" ON "SymbolVersion"("deviceType")';

/** Called only by explicit bootstrap/maintenance, never a read or request. */
export async function ensureDeviceClassificationStorage(db: Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">) {
  const columns = await db.$queryRawUnsafe<Array<{ name: string; type: string; notnull: bigint }>>('PRAGMA table_info("SymbolVersion")');
  if (!columns.some(column => column.name === "metadataJson")) throw new Error("SymbolVersion storage is unavailable.");
  const type = columns.find(column => column.name === "deviceType");
  if (type && (type.type.toUpperCase() !== "TEXT" || Number(type.notnull) !== 0)) throw new Error("Unexpected SymbolVersion Device Type column.");
  if (!type) await db.$executeRawUnsafe('ALTER TABLE "SymbolVersion" ADD COLUMN "deviceType" TEXT');
  await db.$executeRawUnsafe(DEVICE_TYPE_INDEX_SQL);
}
