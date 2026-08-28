export type AuditSeverity =
  | "info"
  | "low"
  | "moderate"
  | "high"
  | "critical";

export type AuditAdvisory = {
  name: string;
  title: string;
  url: string;
  severity: AuditSeverity;
};

export type AuditVulnerability = {
  name: string;
  severity: AuditSeverity;
  via: Array<string | AuditAdvisory>;
};

export type NpmAuditReport = {
  auditReportVersion: 2;
  vulnerabilities: Record<string, AuditVulnerability>;
};

export type AuditAllowlistEntry = {
  advisoryId: string;
  packages: readonly string[];
  maximumSeverity: AuditSeverity;
  expiresOn: string;
  rationale: string;
};

export type AuditFinding = {
  packageName: string;
  severity: AuditSeverity;
  advisoryIds: string[];
  message: string;
};

export type AuditEvaluation = {
  passed: boolean;
  accepted: AuditFinding[];
  blocking: AuditFinding[];
  nonBlocking: AuditFinding[];
};

// The formerly excepted PostCSS and UUID chains are patched. Keep the strict
// evaluator for future policy review, but do not silently tolerate any findings.
export const DEFAULT_AUDIT_ALLOWLIST: readonly AuditAllowlistEntry[] = [];

const severityRank: Record<AuditSeverity, number> = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4
};

const severityValues = new Set<AuditSeverity>([
  "info",
  "low",
  "moderate",
  "high",
  "critical"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSeverity(value: unknown, path: string): AuditSeverity {
  if (typeof value !== "string" || !severityValues.has(value as AuditSeverity)) {
    throw new Error(`${path} must be a supported audit severity.`);
  }

  return value as AuditSeverity;
}

function parseAdvisory(value: unknown, path: string): AuditAdvisory {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an advisory object or package name.`);
  }

  for (const key of ["name", "title", "url"] as const) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      throw new Error(`${path}.${key} must be a non-empty string.`);
    }
  }

  return {
    name: value.name as string,
    title: value.title as string,
    url: value.url as string,
    severity: parseSeverity(value.severity, `${path}.severity`)
  };
}

export function parseAuditReport(value: unknown): NpmAuditReport {
  if (!isRecord(value)) {
    throw new Error("npm audit output must be a JSON object.");
  }

  if (value.auditReportVersion !== 2) {
    throw new Error("Only npm audit report version 2 is supported.");
  }

  if (!isRecord(value.vulnerabilities)) {
    throw new Error("npm audit output must include a vulnerabilities object.");
  }

  const vulnerabilities: Record<string, AuditVulnerability> = {};

  for (const [packageName, rawVulnerability] of Object.entries(
    value.vulnerabilities
  )) {
    if (!isRecord(rawVulnerability)) {
      throw new Error(`vulnerabilities.${packageName} must be an object.`);
    }

    if (
      typeof rawVulnerability.name !== "string" ||
      rawVulnerability.name.length === 0
    ) {
      throw new Error(`vulnerabilities.${packageName}.name must be a string.`);
    }

    if (!Array.isArray(rawVulnerability.via)) {
      throw new Error(`vulnerabilities.${packageName}.via must be an array.`);
    }

    vulnerabilities[packageName] = {
      name: rawVulnerability.name,
      severity: parseSeverity(
        rawVulnerability.severity,
        `vulnerabilities.${packageName}.severity`
      ),
      via: rawVulnerability.via.map((entry, index) => {
        if (typeof entry === "string" && entry.length > 0) {
          return entry;
        }

        return parseAdvisory(
          entry,
          `vulnerabilities.${packageName}.via[${index}]`
        );
      })
    };
  }

  return {
    auditReportVersion: 2,
    vulnerabilities
  };
}

function advisoryIdFromUrl(url: string): string | null {
  return url.match(/GHSA-[0-9a-z-]+/i)?.[0]?.toUpperCase() ?? null;
}

function expirationEndUtc(expiresOn: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
    throw new Error(`Invalid allowlist expiration date: ${expiresOn}`);
  }

  const expiration = Date.parse(`${expiresOn}T23:59:59.999Z`);
  if (Number.isNaN(expiration)) {
    throw new Error(`Invalid allowlist expiration date: ${expiresOn}`);
  }

  return expiration;
}

type TraceResult = {
  allowed: boolean;
  advisoryIds: Set<string>;
  messages: string[];
};

export function evaluateAuditReport(
  report: NpmAuditReport,
  options: {
    now?: Date;
    threshold?: AuditSeverity;
    allowlist?: readonly AuditAllowlistEntry[];
  } = {}
): AuditEvaluation {
  const now = options.now ?? new Date();
  const threshold = options.threshold ?? "moderate";
  const allowlist = options.allowlist ?? DEFAULT_AUDIT_ALLOWLIST;
  const allowlistById = new Map(
    allowlist.map((entry) => [entry.advisoryId.toUpperCase(), entry])
  );
  const observedAllowlistIds = new Set<string>();
  const accepted: AuditFinding[] = [];
  const blocking: AuditFinding[] = [];
  const nonBlocking: AuditFinding[] = [];
  const memo = new Map<string, TraceResult>();

  for (const entry of allowlist) {
    try {
      if (now.getTime() > expirationEndUtc(entry.expiresOn)) {
        blocking.push({
          packageName: `policy:${entry.advisoryId}`,
          severity: entry.maximumSeverity,
          advisoryIds: [entry.advisoryId],
          message: `Temporary exception expired on ${entry.expiresOn}.`
        });
      }
    } catch (error) {
      blocking.push({
        packageName: `policy:${entry.advisoryId}`,
        severity: entry.maximumSeverity,
        advisoryIds: [entry.advisoryId],
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const tracePackage = (packageName: string, path: string[]): TraceResult => {
    const existing = memo.get(packageName);
    if (existing) {
      return existing;
    }

    if (path.includes(packageName)) {
      return {
        allowed: false,
        advisoryIds: new Set(),
        messages: [`Cyclic audit dependency chain: ${[...path, packageName].join(" -> ")}.`]
      };
    }

    const vulnerability = report.vulnerabilities[packageName];
    if (!vulnerability) {
      return {
        allowed: false,
        advisoryIds: new Set(),
        messages: [`Audit chain references missing package ${packageName}.`]
      };
    }

    if (vulnerability.via.length === 0) {
      return {
        allowed: false,
        advisoryIds: new Set(),
        messages: [`${packageName} has no advisory or dependency chain to review.`]
      };
    }

    const advisoryIds = new Set<string>();
    const messages: string[] = [];
    let allowed = true;

    for (const via of vulnerability.via) {
      if (typeof via === "string") {
        const child = tracePackage(via, [...path, packageName]);
        child.advisoryIds.forEach((id) => advisoryIds.add(id));
        messages.push(...child.messages);
        allowed &&= child.allowed;
        continue;
      }

      const advisoryId = advisoryIdFromUrl(via.url);
      if (!advisoryId) {
        allowed = false;
        messages.push(`${packageName} advisory URL does not contain a GHSA ID.`);
        continue;
      }

      advisoryIds.add(advisoryId);
      const exception = allowlistById.get(advisoryId);
      if (!exception) {
        allowed = false;
        messages.push(`${advisoryId} is not allowlisted.`);
        continue;
      }

      observedAllowlistIds.add(advisoryId);
      if (!exception.packages.includes(packageName)) {
        allowed = false;
        messages.push(`${advisoryId} is not approved for package ${packageName}.`);
      }
      if (severityRank[via.severity] > severityRank[exception.maximumSeverity]) {
        allowed = false;
        messages.push(
          `${advisoryId} advisory severity ${via.severity} exceeds approved ${exception.maximumSeverity}.`
        );
      }
    }

    for (const advisoryId of advisoryIds) {
      const exception = allowlistById.get(advisoryId);
      if (!exception || !exception.packages.includes(packageName)) {
        allowed = false;
        messages.push(`${advisoryId} dependency chain expanded to ${packageName}.`);
        continue;
      }
      if (
        severityRank[vulnerability.severity] >
        severityRank[exception.maximumSeverity]
      ) {
        allowed = false;
        messages.push(
          `${packageName} severity ${vulnerability.severity} exceeds approved ${exception.maximumSeverity}.`
        );
      }
    }

    const result = { allowed, advisoryIds, messages: [...new Set(messages)] };
    memo.set(packageName, result);
    return result;
  };

  for (const [packageName, vulnerability] of Object.entries(
    report.vulnerabilities
  )) {
    if (severityRank[vulnerability.severity] < severityRank[threshold]) {
      nonBlocking.push({
        packageName,
        severity: vulnerability.severity,
        advisoryIds: [],
        message: `Below the configured ${threshold} audit threshold.`
      });
      continue;
    }

    const trace = tracePackage(packageName, []);
    const finding: AuditFinding = {
      packageName,
      severity: vulnerability.severity,
      advisoryIds: [...trace.advisoryIds].sort(),
      message:
        trace.messages.join(" ") ||
        "Matches a reviewed temporary dependency exception."
    };

    if (trace.allowed) {
      accepted.push(finding);
    } else {
      blocking.push(finding);
    }
  }

  for (const entry of allowlist) {
    if (!observedAllowlistIds.has(entry.advisoryId.toUpperCase())) {
      blocking.push({
        packageName: `policy:${entry.advisoryId}`,
        severity: entry.maximumSeverity,
        advisoryIds: [entry.advisoryId],
        message: "Allowlisted advisory is absent or below threshold; remove the stale exception."
      });
    }
  }

  return {
    passed: blocking.length === 0,
    accepted,
    blocking,
    nonBlocking
  };
}
