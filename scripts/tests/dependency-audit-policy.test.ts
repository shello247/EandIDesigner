import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIT_ALLOWLIST,
  evaluateAuditReport,
  parseAuditReport,
  type AuditSeverity,
  type AuditAllowlistEntry
} from "../dependency-audit-policy";

const evaluationDate = new Date("2026-07-21T12:00:00.000Z");

// Historical fixtures exercise expiry/chain guards independently of live policy.
const historicalAllowlist: readonly AuditAllowlistEntry[] = [
  { advisoryId: "GHSA-qx2v-qp2m-jg93", packages: ["postcss", "next"],
    maximumSeverity: "moderate", expiresOn: "2026-08-20", rationale: "Historical test fixture" },
  { advisoryId: "GHSA-w5hq-g745-h8pq", packages: ["uuid", "exceljs"],
    maximumSeverity: "moderate", expiresOn: "2026-08-20", rationale: "Historical test fixture" }
];

function advisory(advisoryId: string, severity: AuditSeverity = "moderate") {
  return {
    name: advisoryId,
    title: `Advisory ${advisoryId}`,
    url: `https://github.com/advisories/${advisoryId}`,
    severity
  };
}

type TestAdvisory = ReturnType<typeof advisory>;

type TestVulnerability = {
  name: string;
  severity: AuditSeverity;
  via: Array<string | TestAdvisory>;
};

type TestAuditReport = {
  auditReportVersion: 2;
  vulnerabilities: Record<string, TestVulnerability>;
};

function currentAuditReport(): TestAuditReport {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      postcss: {
        name: "postcss",
        severity: "moderate",
        via: [advisory("GHSA-qx2v-qp2m-jg93")]
      },
      next: {
        name: "next",
        severity: "moderate",
        via: ["postcss"]
      },
      uuid: {
        name: "uuid",
        severity: "moderate",
        via: [advisory("GHSA-w5hq-g745-h8pq")]
      },
      exceljs: {
        name: "exceljs",
        severity: "moderate",
        via: ["uuid"]
      }
    }
  };
}

function evaluate(value: unknown, now = evaluationDate) {
  return evaluateAuditReport(parseAuditReport(value), { now, allowlist: historicalAllowlist });
}

describe("dependency audit policy", () => {
  it("has only the approved, dated tooling exception and no production exceptions", () => {
    expect(DEFAULT_AUDIT_ALLOWLIST).toHaveLength(1);
    expect(DEFAULT_AUDIT_ALLOWLIST[0]).toMatchObject({
      advisoryId: "GHSA-vfj7-8cjw-p6xm", maximumSeverity: "high", expiresOn: "2026-10-22",
      packages: ["braces", "micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next"]
    });
    expect(evaluateAuditReport(parseAuditReport({
      auditReportVersion: 2, vulnerabilities: {}
    }), { allowlist: [], threshold: "info" }).passed).toBe(true);
  });

  function toolingReport(): TestAuditReport {
    return { auditReportVersion: 2, vulnerabilities: {
      braces: { name: "braces", severity: "high", via: [advisory("GHSA-vfj7-8cjw-p6xm", "high")] },
      micromatch: { name: "micromatch", severity: "high", via: ["braces"] },
      "fast-glob": { name: "fast-glob", severity: "high", via: ["micromatch"] },
      "@next/eslint-plugin-next": { name: "@next/eslint-plugin-next", severity: "high", via: ["fast-glob"] },
      "eslint-config-next": { name: "eslint-config-next", severity: "high", via: ["@next/eslint-plugin-next"] }
    } };
  }

  it("accepts the tooling chain through 22 October but blocks it after expiry", () => {
    const report = toolingReport();
    expect(evaluateAuditReport(report, { now: new Date("2026-10-22T23:59:59.000Z") }).passed).toBe(true);
    expect(evaluateAuditReport(report, { now: new Date("2026-10-23T00:00:00.000Z") }).passed).toBe(false);
  });

  it("never accepts the tooling advisory if it enters production", () => {
    const result = evaluateAuditReport(toolingReport(), { allowlist: [], threshold: "info" });
    expect(result.passed).toBe(false);
    expect(result.accepted).toHaveLength(0);
    expect(result.blocking).toHaveLength(5);
  });

  it("blocks critical severity, expanded chains and stale tooling exceptions", () => {
    const options = { now: new Date("2026-10-08T12:00:00.000Z") };
    const critical = toolingReport();
    critical.vulnerabilities.braces.severity = "critical";
    expect(evaluateAuditReport(critical, options).passed).toBe(false);
    const expanded = toolingReport();
    expanded.vulnerabilities.next = { name: "next", severity: "high", via: ["braces"] };
    expect(evaluateAuditReport(expanded, options).blocking.some((finding) => finding.packageName === "next")).toBe(true);
    expect(evaluateAuditReport({ auditReportVersion: 2, vulnerabilities: {} }, options).passed).toBe(false);
  });

  it("blocks the previously excepted chains under the current policy", () => {
    const result = evaluateAuditReport(parseAuditReport(currentAuditReport()));
    expect(result.passed).toBe(false);
    expect(result.accepted).toEqual([]);
    expect(result.blocking.filter((finding) => !finding.packageName.startsWith("policy:")).map((finding) => finding.packageName).sort()).toEqual([
      "exceljs", "next", "postcss", "uuid"
    ]);
  });
  it("accepts only the two reviewed advisory chains before expiration", () => {
    const result = evaluate(currentAuditReport());

    expect(result.passed).toBe(true);
    expect(result.blocking).toEqual([]);
    expect(result.accepted.map((finding) => finding.packageName).sort()).toEqual([
      "exceljs",
      "next",
      "postcss",
      "uuid"
    ]);
  });

  it.each(["moderate", "high", "critical"] as const)(
    "blocks a new %s advisory",
    (severity) => {
      const report = currentAuditReport();
      report.vulnerabilities["new-package"] = {
        name: "new-package",
        severity,
        via: [advisory("GHSA-aaaa-bbbb-cccc", severity)]
      };

      const result = evaluate(report);

      expect(result.passed).toBe(false);
      expect(
        result.blocking.some(
          (finding) => finding.packageName === "new-package"
        )
      ).toBe(true);
    }
  );

  it("fails when an exception expires", () => {
    const result = evaluate(
      currentAuditReport(),
      new Date("2026-08-21T00:00:00.000Z")
    );

    expect(result.passed).toBe(false);
    expect(
      result.blocking.filter((finding) => finding.packageName.startsWith("policy:"))
    ).toHaveLength(2);
  });

  it("fails when an allowlisted advisory becomes stale", () => {
    const report = currentAuditReport();
    delete report.vulnerabilities.uuid;
    delete report.vulnerabilities.exceljs;

    const result = evaluate(report);

    expect(result.passed).toBe(false);
    expect(
      result.blocking.some(
        (finding) =>
          finding.packageName === "policy:GHSA-w5hq-g745-h8pq" &&
          finding.message.includes("stale")
      )
    ).toBe(true);
  });

  it("fails when an allowlisted advisory severity increases", () => {
    const report = currentAuditReport();
    report.vulnerabilities.postcss = {
      name: "postcss",
      severity: "high",
      via: [advisory("GHSA-qx2v-qp2m-jg93", "high")]
    };

    const result = evaluate(report);

    expect(result.passed).toBe(false);
    expect(
      result.blocking.some((finding) => finding.packageName === "postcss")
    ).toBe(true);
  });

  it("fails when an allowlisted chain expands to another package", () => {
    const report = currentAuditReport();
    report.vulnerabilities["unexpected-parent"] = {
      name: "unexpected-parent",
      severity: "moderate",
      via: ["postcss"]
    };

    const result = evaluate(report);

    expect(result.passed).toBe(false);
    expect(
      result.blocking.find(
        (finding) => finding.packageName === "unexpected-parent"
      )?.message
    ).toContain("expanded");
  });

  it("fails closed on cyclic dependency chains", () => {
    const report = currentAuditReport();
    report.vulnerabilities.cycleA = {
      name: "cycleA",
      severity: "moderate",
      via: ["cycleB"]
    };
    report.vulnerabilities.cycleB = {
      name: "cycleB",
      severity: "moderate",
      via: ["cycleA"]
    };

    const result = evaluate(report);

    expect(result.passed).toBe(false);
    expect(result.blocking.some((finding) => finding.message.includes("Cyclic"))).toBe(
      true
    );
  });

  it("reports low and informational findings without blocking", () => {
    const report = currentAuditReport();
    report.vulnerabilities.lowPackage = {
      name: "lowPackage",
      severity: "low",
      via: [advisory("GHSA-low0-low0-low0", "low")]
    };
    report.vulnerabilities.infoPackage = {
      name: "infoPackage",
      severity: "info",
      via: [advisory("GHSA-info-info-info", "info")]
    };

    const result = evaluate(report);

    expect(result.passed).toBe(true);
    expect(result.nonBlocking).toHaveLength(2);
  });

  it("fails parsing malformed and unsupported reports", () => {
    expect(() => parseAuditReport({ auditReportVersion: 1 })).toThrow(
      "version 2"
    );
    expect(() =>
      parseAuditReport({ auditReportVersion: 2, vulnerabilities: [] })
    ).toThrow("vulnerabilities object");
    expect(() =>
      parseAuditReport({
        auditReportVersion: 2,
        vulnerabilities: {
          broken: { name: "broken", severity: "unknown", via: [] }
        }
      })
    ).toThrow("supported audit severity");
  });

  it("fails closed on invalid allowlist dates", () => {
    const invalidAllowlist = [
      {
        ...historicalAllowlist[0],
        expiresOn: "not-a-date"
      },
      historicalAllowlist[1]
    ];
    const report = parseAuditReport(currentAuditReport());
    const result = evaluateAuditReport(report, {
      now: evaluationDate,
      allowlist: invalidAllowlist
    });

    expect(result.passed).toBe(false);
    expect(
      result.blocking.some((finding) =>
        finding.message.includes("Invalid allowlist expiration")
      )
    ).toBe(true);
  });
});
