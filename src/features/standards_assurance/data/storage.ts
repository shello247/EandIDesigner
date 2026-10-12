import type { Prisma } from "@prisma/client";
import { STANDARDS_STORAGE_SQL } from "./storage-sql";
export type StorageClient = Pick<Prisma.TransactionClient, "$executeRawUnsafe" | "$queryRawUnsafe">;
export const immutableTables = ["StandardReferenceRevision", "StandardRequirementRevision", "StandardImplementationRevision", "StandardProfileRevision", "StandardProfileEntry", "StandardEvidence", "StandardReviewNote", "StandardSnapshot", "StandardAuditEvent"] as const;
export function standardsStorageStatements() {
  return [...STANDARDS_STORAGE_SQL, ...immutableTables.flatMap(table => ["UPDATE", "DELETE"].map(operation =>
    'CREATE TRIGGER IF NOT EXISTS "' + table + '_immutable_' + operation.toLowerCase() + '" BEFORE ' + operation + ' ON "' + table + '" BEGIN SELECT RAISE(ABORT, \'Standards history is immutable; create a new revision\'); END;'
  ))];
}
const normalized = (sql: string) => sql.replaceAll("IF NOT EXISTS ", "").replace(/\s+/g, " ").trim().replace(/;$/, "");
export async function ensureStandardsStorage(db: StorageClient) {
  const rows = await db.$queryRawUnsafe<Array<{ name: string; sql: string | null }>>("SELECT name, sql FROM sqlite_master WHERE name LIKE 'Standard%'");
  const actual = new Map(rows.map(row => [row.name, row.sql]));
  for (const sql of standardsStorageStatements()) {
    const name = /(?:TABLE|INDEX|TRIGGER) IF NOT EXISTS "([^"]+)"/.exec(sql)?.[1];
    if (!name) throw new Error("Invalid standards schema definition.");
    if (actual.has(name) && normalized(actual.get(name) ?? "") !== normalized(sql)) throw new Error("Unexpected standards schema: " + name);
  }
  for (const sql of standardsStorageStatements()) await db.$executeRawUnsafe(sql);
}

