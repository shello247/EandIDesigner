import { PrismaClient } from "@prisma/client";
import { mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureStandardsStorage } from "../data/storage";
import { resolveAuditConfiguration } from "../../../../scripts/drawing-performance-audit/run-config.mjs";
export function standardsTestDirectory(cwd = process.cwd(), env: Record<string, string | undefined> = process.env) {
  const root = realpathSync(cwd);
  if (env.GITHUB_ACTIONS === "true") {
    // Reuse the strict repository/workspace/run-identity guard, not a bare CI flag.
    resolveAuditConfiguration(root, undefined, env);
  } else if (!root.replaceAll("\\", "/").includes("/Application Folders/Working Branches/")) {
    throw new Error("Use an isolated linked worktree.");
  }
  return path.join(root, "artifacts", "standards-assurance", "tests");
}
export async function testDatabase() {
  const root = realpathSync(process.cwd());
  const dir = standardsTestDirectory();
  mkdirSync(dir, { recursive: true });
  if (!realpathSync(dir).startsWith(root + path.sep)) throw new Error("Redirected test directory.");
  const file = path.join(dir, randomUUID() + ".db");
  const db = new PrismaClient({ datasources: { db: { url: "file:" + file.replaceAll("\\", "/") } } });
  await ensureStandardsStorage(db);
  return db;
}

