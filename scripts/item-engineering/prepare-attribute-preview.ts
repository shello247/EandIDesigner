import { PrismaClient } from "@prisma/client";
import { resolveAuditConfiguration, assertAuditDatabase } from "../drawing-performance-audit/run-config.mjs";
import { ensureItemEngineeringStorage } from "../../src/features/item_engineering/data/storage";
const configuration = resolveAuditConfiguration();
assertAuditDatabase(configuration);
const db = new PrismaClient({ datasourceUrl: configuration.databaseUrl });
try {
  const connected = await db.$queryRawUnsafe<Array<{ name: string; file: string }>>("PRAGMA database_list");
  if (connected.find(row => row.name === "main")?.file.replaceAll("\\", "/") !== configuration.database.replaceAll("\\", "/")) throw new Error("Substitute database refused.");
  await db.$transaction(tx => ensureItemEngineeringStorage(tx), { timeout: 30000 });
  console.log("Isolated attribute storage ready. Canonical database was not accessed.");
} finally { await db.$disconnect(); }
