import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  findCanonicalMainWorktree,
  parseGitWorktreeList,
  toPrismaSqliteFileUrl
} from "./development-runtime";

const TABLE_NAME = "DrawingSheetTemplate";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const applicationRoot = path.resolve(scriptDirectory, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(applicationRoot, "package.json"), "utf8")
) as { name?: string };

if (packageJson.name !== "ei-designer") {
  throw new Error(
    `Refusing to retire storage for an unexpected application at ${applicationRoot}.`
  );
}

const argumentsList = process.argv.slice(2);
const apply = argumentsList.includes("--apply");
const unsupportedArguments = argumentsList.filter(
  (argument) => argument !== "--apply"
);

if (unsupportedArguments.length > 0) {
  throw new Error(`Unsupported argument: ${unsupportedArguments.join(", ")}`);
}

const worktreeOutput = execFileSync(
  "git",
  ["-C", applicationRoot, "worktree", "list", "--porcelain"],
  { encoding: "utf8" }
);
const canonicalWorktree = findCanonicalMainWorktree(
  parseGitWorktreeList(worktreeOutput)
);
const canonicalDatabasePath = path.join(
  canonicalWorktree.path,
  "prisma",
  "dev.db"
);

if (
  !existsSync(canonicalDatabasePath) ||
  !statSync(canonicalDatabasePath).isFile()
) {
  throw new Error(
    `Canonical database is unavailable at ${canonicalDatabasePath}. Refusing to use a substitute database.`
  );
}

process.env.DATABASE_URL = toPrismaSqliteFileUrl(canonicalDatabasePath);

const prisma = new PrismaClient();

async function tableExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${TABLE_NAME}'`
  );
  return rows.length === 1;
}

async function templateCount(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count FROM "${TABLE_NAME}"`
  );
  return Number(rows[0]?.count ?? 0n);
}

try {
  console.log(`[sheet-template-retirement] Database: ${canonicalDatabasePath}`);

  if (!(await tableExists())) {
    console.log(`[sheet-template-retirement] ${TABLE_NAME} is already absent.`);
    process.exitCode = 0;
  } else {
    const count = await templateCount();
    console.log(
      `[sheet-template-retirement] ${TABLE_NAME} contains ${count} record${count === 1 ? "" : "s"}.`
    );

    if (!apply) {
      console.log(
        "[sheet-template-retirement] Dry run only. Re-run with --apply to permanently drop this table and its records."
      );
    } else {
      await prisma.$executeRawUnsafe(`DROP TABLE "${TABLE_NAME}"`);

      if (await tableExists()) {
        throw new Error(`${TABLE_NAME} still exists after the retirement operation.`);
      }

      console.log(
        `[sheet-template-retirement] Permanently removed ${TABLE_NAME} and ${count} stored record${count === 1 ? "" : "s"}.`
      );
    }
  }
} finally {
  await prisma.$disconnect();
}
