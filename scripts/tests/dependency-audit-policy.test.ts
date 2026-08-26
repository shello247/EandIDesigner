import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIT_ALLOWLIST,
  evaluateAuditReport,
  parseAuditReport,
  type AuditSeverity
} from "../dependency-audit-policy";

const evaluationDate = new Date("2026-07-21T12:00:00.000Z");

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
  return evaluateAuditReport(parseAuditReport(value), { now });
}

describe("dependency audit policy", () => {
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
        ...DEFAULT_AUDIT_ALLOWLIST[0],
        expiresOn: "not-a-date"
      },
      DEFAULT_AUDIT_ALLOWLIST[1]
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
