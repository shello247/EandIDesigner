import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { findCanonicalMainWorktree, parseGitWorktreeList } from "./development-runtime";
import { applySymbolGuidanceRetirement, assertRetirementPath, guidanceRetirementInventorySchema, inventorySymbolGuidance } from "../src/features/symbol_registry/api/maintenance";

export function parseGuidanceRetirementArguments(args: string[]) {
  if (!args.length) return { apply: false as const };
  if (args.length !== 4 || args[0] !== "--apply" || args[2] !== "--inventory-sha256") throw new Error("Use no arguments for dry run, or --apply <inventory.json> --inventory-sha256 <reviewed hash>.");
  return { apply: true as const, inventoryPath: z.string().min(1).parse(args[1]), inventorySha256: z.string().regex(/^[a-f0-9]{64}$/).parse(args[3]) };
}

async function assertLiveServerStopped() {
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port: 3000 });
    socket.once("connect", () => { socket.destroy(); reject(new Error("Stop the owned port-3000 server before applying retirement.")); });
    socket.once("error", error => (error as NodeJS.ErrnoException).code === "ECONNREFUSED" ? resolve() : reject(error));
    socket.setTimeout(1500, () => { socket.destroy(); reject(new Error("Cannot verify port 3000 is stopped.")); });
  });
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong application.");
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  const canonical = findCanonicalMainWorktree(parseGitWorktreeList(git("worktree", "list", "--porcelain"))).path;
  const databasePath = assertRetirementPath(path.join(canonical, "prisma/dev.db"), canonical);
  const archiveRoot = assertRetirementPath(path.join(canonical, "artifacts/symbol-guidance-retirement"), canonical, false);
  const sourceCommit = git("rev-parse", "HEAD");
  const options = parseGuidanceRetirementArguments(process.argv.slice(2));
  if (options.apply && git("status", "--porcelain", "--untracked-files=normal", "--", "src", "scripts", "prisma", "package.json", "package-lock.json")) throw new Error("Checkpoint application source before applying retirement.");
  mkdirSync(archiveRoot, { recursive: true });
  if (!options.apply) {
    const db = new DatabaseSync(databasePath, { readOnly: true });
    try {
      db.exec("BEGIN");
      const inventory = inventorySymbolGuidance(db, databasePath, sourceCommit);
      db.exec("COMMIT");
      const file = assertRetirementPath(path.join(archiveRoot, "inventory-" + randomUUID() + ".json"), archiveRoot, false);
      const text = JSON.stringify(inventory, null, 2) + "\n";
      writeFileSync(file, text, { flag: "wx" });
      console.log(JSON.stringify({ status: "dry-run", inventoryPath: file, inventorySha256: createHash("sha256").update(text).digest("hex"), counts: Object.fromEntries(Object.entries(inventory.retiredRecords).map(([name, rows]) => [name, rows.length])) }, null, 2));
    } finally { db.close(); }
    return;
  }
  const inventoryPath = assertRetirementPath(options.inventoryPath, archiveRoot);
  const inventoryBytes = readFileSync(inventoryPath);
  if (createHash("sha256").update(inventoryBytes).digest("hex") !== options.inventorySha256) throw new Error("Reviewed inventory hash does not match.");
  const inventory = guidanceRetirementInventorySchema.parse(JSON.parse(inventoryBytes.toString("utf8")));
  await assertLiveServerStopped();
  const runPath = assertRetirementPath(path.join(archiveRoot, "run-" + randomUUID()), archiveRoot, false);
  mkdirSync(runPath);
  const backupPath = assertRetirementPath(path.join(runPath, "pre-retirement.db"), archiveRoot, false);
  const manifestPath = assertRetirementPath(path.join(runPath, "manifest.json"), archiveRoot, false);
  const db = new DatabaseSync(databasePath);
  try {
    const result = applySymbolGuidanceRetirement(db, { inventory, sourceDatabase: databasePath, sourceCommit, backupPath });
    const manifest = { ...result, sourceCommit, databasePath, inventoryPath, inventorySha256: options.inventorySha256, completedAt: new Date().toISOString() };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify({ status: result.status, manifestPath, backupPath: result.status === "retired" ? result.backupPath : null }, null, 2));
  } finally { db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
