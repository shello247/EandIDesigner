import { PrismaClient } from "@prisma/client";
import { mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureStandardsStorage } from "../data/storage";
export async function testDatabase() {
  const root = realpathSync(process.cwd());
  if (!root.replaceAll("\\", "/").includes("/Application Folders/Working Branches/")) throw new Error("Use an isolated linked worktree.");
  const dir = path.join(root, "artifacts", "standards-assurance", "tests");
  mkdirSync(dir, { recursive: true });
  if (!realpathSync(dir).startsWith(root + path.sep)) throw new Error("Redirected test directory.");
  const file = path.join(dir, randomUUID() + ".db");
  const db = new PrismaClient({ datasources: { db: { url: "file:" + file.replaceAll("\\", "/") } } });
  await ensureStandardsStorage(db);
  return db;
}

