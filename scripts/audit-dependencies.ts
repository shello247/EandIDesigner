import { spawnSync } from "node:child_process";
import {
  DEFAULT_AUDIT_ALLOWLIST,
  evaluateAuditReport,
  parseAuditReport
} from "./dependency-audit-policy";

function readAudit(production: boolean) {
  const args = ["audit", ...(production ? ["--omit=dev"] : []), "--json"];
  const audit = process.platform === "win32"
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], {
        encoding: "utf8", windowsHide: true, maxBuffer: 10 * 1024 * 1024
      })
    : spawnSync("npm", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (audit.error) throw new Error(`Dependency audit could not start: ${audit.error.message}`);
  if (audit.status !== 0 && audit.status !== 1) {
    throw new Error(`npm audit failed with exit code ${String(audit.status)}. ${audit.stderr.trim()}`);
  }
  return parseAuditReport(JSON.parse(audit.stdout));
}

try {
  // A tooling exception can never mask the same package entering production.
  // All production findings, including low/informational findings, block release.
  const production = evaluateAuditReport(readAudit(true), { allowlist: [], threshold: "info" });
  if (!production.passed) {
    for (const finding of production.blocking) {
      console.error(`Production dependency finding: ${finding.packageName}: ${finding.message}`);
    }
    process.exit(1);
  }
  console.log("Production dependency audit passed: 0 findings, no exceptions.");

  const evaluation = evaluateAuditReport(readAudit(false));
  for (const finding of evaluation.accepted) {
    console.warn(`Accepted tooling finding: ${finding.severity} ${finding.packageName}`);
    for (const advisoryId of finding.advisoryIds) {
      const policy = DEFAULT_AUDIT_ALLOWLIST.find((entry) => entry.advisoryId.toUpperCase() === advisoryId);
      if (policy) console.warn(`  ${advisoryId}; expires ${policy.expiresOn}. ${policy.rationale}`);
    }
  }
  if (!evaluation.passed) {
    for (const finding of evaluation.blocking) {
      console.error(`Blocking dependency finding: ${finding.packageName}: ${finding.message}`);
    }
    process.exit(1);
  }
  console.log(`Dependency audit passed: ${evaluation.accepted.length} temporarily accepted, ` +
    `${evaluation.nonBlocking.length} below threshold, 0 blocking.`);
} catch (error) {
  console.error("Dependency audit policy evaluation failed closed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
