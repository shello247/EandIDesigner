import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";
const configuration = resolveAuditConfiguration();
const root = configuration.root;
// Each approved worktree keeps standards verification separate from other suites.
const isolatedDatabase = path.join(root, "prisma", "test-standards-assurance.db");
if (fs.realpathSync(path.dirname(isolatedDatabase)) !== path.dirname(isolatedDatabase) ||
    (fs.existsSync(isolatedDatabase) && fs.realpathSync(isolatedDatabase) !== isolatedDatabase)) throw new Error("Redirected standards test database.");
configuration.database = isolatedDatabase;
configuration.databaseUrl = "file:" + isolatedDatabase.replaceAll("\\", "/");
const command = process.argv[2];
const modes = {
  bootstrap: ["node_modules/tsx/dist/cli.mjs", "scripts/bootstrap-sqlite.ts"],
  build: ["node_modules/next/dist/bin/next", "build", "--webpack"],
  server: ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3120"],
  preview: ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3120"],
  browser: ["node_modules/@playwright/test/cli.js", "test", "--config", "scripts/standards-assurance/playwright.config.ts", "--reporter=line"]
};
if (!modes[command]) throw new Error("Unknown isolated standards verification command.");
if (command === "server" || command === "preview") {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error("Port 3120 is occupied; do not replace another application.")));
    probe.listen(3120, "127.0.0.1", () => probe.close(resolve));
  });
}
const output = path.join(root, "artifacts", "standards-assurance", "runs");
fs.mkdirSync(output, { recursive: true });
const runId = command + "-" + new Date().toISOString().replace(/[:.]/g, "-");
const log = fs.createWriteStream(path.join(output, runId + ".log"), { flags: "wx" });
const start = Date.now();
const args = [...modes[command], ...process.argv.slice(3)];
const env = { ...process.env, DATABASE_URL: configuration.databaseUrl, NEXT_TELEMETRY_DISABLED: "1", OPENAI_TERMINAL_MAP_MOCK: "true", OPENAI_BOM_ITEM_EXTRACTION_MOCK: "true" };
const child = spawn(process.execPath, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
for (const stream of [child.stdout, child.stderr]) stream.on("data", data => { log.write(data); process.stdout.write(data); });
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("error", error => { log.write(error.message); });
child.on("close", (code, signal) => {
  log.end();
  fs.writeFileSync(path.join(output, runId + ".json"), JSON.stringify({ command, args, started: new Date(start).toISOString(), elapsedMs: Date.now() - start, exitCode: code, signal, database: configuration.database }, null, 2));
  process.exitCode = code ?? 1;
});

