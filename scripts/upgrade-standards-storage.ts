import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { parseStandardsUpgradeArguments, standardsUpgradeDatabaseUrl, upgradeStandardsStorage, seedStandards } from "../src/features/standards_assurance/api/server";
import { findCanonicalMainWorktree, parseGitWorktreeList } from "./development-runtime";
async function main() {
  const { apply } = parseStandardsUpgradeArguments(process.argv.slice(2));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong application");
  const workspace = path.resolve(root, "../../..");
  if (!existsSync(path.join(workspace, ".ei-workspace-root"))) throw new Error("Workspace marker is missing.");
  const worktrees = parseGitWorktreeList(execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], { encoding: "utf8" }));
  const canonical = findCanonicalMainWorktree(worktrees);
  if (path.resolve(canonical.path) !== path.join(workspace, "Application Folders/Main Application/EI_Designer")) {
    throw new Error("Canonical-main target mismatch.");
  }
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error("Stop port 3000 before storage upgrade.")));
    probe.listen(3000, "127.0.0.1", () => probe.close(error => error ? reject(error) : resolve()));
  });
  const databasePath = path.join(canonical.path, "prisma/dev.db");
  if (realpathSync(databasePath) !== databasePath) throw new Error("Redirected canonical database.");
  if (!existsSync(databasePath)) throw new Error("Canonical database unavailable.");
  const db = new PrismaClient({ datasourceUrl: standardsUpgradeDatabaseUrl(databasePath) });
  try {
    const outcome = await upgradeStandardsStorage({
      prisma: db, databasePath, archiveBasePath: path.join(root, "artifacts/standards-assurance/storage"),
      sourceCommit: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), apply
    });
    if (apply) await seedStandards(db);
    console.log(JSON.stringify(outcome));
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch(error => { console.error(error); process.exitCode = 1; });
}
