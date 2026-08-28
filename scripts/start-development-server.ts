import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findCanonicalMainWorktree,
  parseGitWorktreeList,
  resolveDevelopmentDatabaseUrl
} from "./development-runtime";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const applicationRoot = path.resolve(scriptDirectory, "..");
const packageJsonPath = path.join(applicationRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
  name?: string;
};

if (packageJson.name !== "ei-designer") {
  throw new Error(
    `Refusing to start an unexpected application at ${applicationRoot}.`
  );
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
    `Canonical database is unavailable at ${canonicalDatabasePath}. Refusing to start with a substitute database.`
  );
}

const forwardedArguments = process.argv.slice(2);
const requestsWebpack = forwardedArguments.includes("--webpack");
const requestsTurbopack = forwardedArguments.includes("--turbopack");

if (requestsWebpack === requestsTurbopack) {
  throw new Error(
    "Select exactly one development bundler: --webpack or --turbopack."
  );
}

const bundlerFlag = requestsWebpack ? "--webpack" : "--turbopack";
const nextArguments = forwardedArguments.filter(
  (argument) => argument !== "--webpack" && argument !== "--turbopack"
);
const databaseUrl = resolveDevelopmentDatabaseUrl({
  canonicalDatabasePath,
  explicitOverride: process.env.EI_DESIGNER_DATABASE_URL
});
const nextCliPath = path.join(
  applicationRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

console.log(`[development] Application worktree: ${applicationRoot}`);
console.log(
  process.env.EI_DESIGNER_DATABASE_URL?.trim()
    ? "[development] Database: explicit EI_DESIGNER_DATABASE_URL override"
    : `[development] Database: canonical main worktree (${canonicalDatabasePath})`
);
console.log(`[development] Bundler: ${bundlerFlag.slice(2)}`);

const child = spawn(
  process.execPath,
  [
    nextCliPath,
    "dev",
    "--hostname",
    "127.0.0.1",
    bundlerFlag,
    ...nextArguments
  ],
  {
    cwd: applicationRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    stdio: "inherit"
  }
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Development server stopped by ${signal}.`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
