import { spawnSync } from "node:child_process";
import {
  DEFAULT_AUDIT_ALLOWLIST,
  evaluateAuditReport,
  parseAuditReport
} from "./dependency-audit-policy";

const npmInvocation =
  process.platform === "win32"
    ? {
        command: process.env.ComSpec ?? "cmd.exe",
        args: ["/d", "/s", "/c", "npm audit --json"]
      }
    : { command: "npm", args: ["audit", "--json"] };

const audit = spawnSync(npmInvocation.command, npmInvocation.args, {
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 10 * 1024 * 1024
});

if (audit.error) {
  console.error(`Dependency audit could not start: ${audit.error.message}`);
  process.exit(1);
}

if (audit.status !== 0 && audit.status !== 1) {
  console.error(`npm audit failed with exit code ${String(audit.status)}.`);
  if (audit.stderr.trim()) {
    console.error(audit.stderr.trim());
  }
  process.exit(1);
}

let rawReport: unknown;
try {
  rawReport = JSON.parse(audit.stdout);
} catch (error) {
  console.error("npm audit returned malformed JSON.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function policyFor(advisoryId: string) {
  return DEFAULT_AUDIT_ALLOWLIST.find(
    (entry) => entry.advisoryId.toUpperCase() === advisoryId.toUpperCase()
  );
}

try {
  const report = parseAuditReport(rawReport);
  const evaluation = evaluateAuditReport(report);

  if (evaluation.accepted.length > 0) {
    console.warn("Accepted temporary dependency findings:");
    for (const finding of evaluation.accepted) {
      const policies = finding.advisoryIds.map((id) => {
        const policy = policyFor(id);
        return policy ? `${id} (expires ${policy.expiresOn})` : id;
      });
      console.warn(
        `- ${finding.severity} ${finding.packageName}: ${policies.join(", ")}`
      );
      for (const advisoryId of finding.advisoryIds) {
        const policy = policyFor(advisoryId);
        if (policy) {
          console.warn(`  Rationale: ${policy.rationale}`);
        }
      }
    }
  }

  if (!evaluation.passed) {
    console.error("Blocking dependency findings:");
    for (const finding of evaluation.blocking) {
      console.error(
        `- ${finding.severity} ${finding.packageName}: ${finding.message}`
      );
    }
    process.exit(1);
  }

  console.log(
    `Dependency audit passed: ${evaluation.accepted.length} temporarily accepted, ` +
      `${evaluation.nonBlocking.length} below threshold, 0 blocking.`
  );
} catch (error) {
  console.error("Dependency audit policy evaluation failed closed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
