import {
  panelAnalysisFindingSchema,
  panelAnalysisRuleOutcomeSchema,
  type PanelAnalysisCategory,
  type PanelAnalysisFinding,
  type PanelAnalysisRuleOutcome
} from "../../data/schema";
import {
  buildPanelAnalysisCoverage,
  buildPanelAnalysisSummary
} from "./panel-analysis-coverage";

export type PanelAnalysisFindingDraft = Omit<
  PanelAnalysisFinding,
  "id" | "ruleCode" | "ruleVersion" | "category"
> & {
  findingKey: string;
};

export type PanelAnalysisRuleApplicability =
  | { applicable: true }
  | { applicable: false; reason: string };

export type PanelAnalysisRuleEvaluation =
  | { status: "passed"; message?: string }
  | { status: "finding"; findings: PanelAnalysisFindingDraft[]; coverage?: "partial" }
  | {
      status: "not_evaluated";
      reason: string;
    };

export type PanelAnalysisRule<TContext> = {
  code: string;
  version: string;
  category: PanelAnalysisCategory;
  isApplicable: (context: TContext) => PanelAnalysisRuleApplicability;
  evaluate: (context: TContext) => PanelAnalysisRuleEvaluation;
};

export type PanelAnalysisRuleRun = {
  findings: PanelAnalysisFinding[];
  outcomes: PanelAnalysisRuleOutcome[];
  coverage: ReturnType<typeof buildPanelAnalysisCoverage>;
  summary: ReturnType<typeof buildPanelAnalysisSummary>;
};

const severityOrder: Record<PanelAnalysisFinding["severity"], number> = {
  error: 0,
  warning: 1,
  data_gap: 2,
  information: 3
};

function compareText(first: string, second: string): number {
  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function compareRules<TContext>(
  first: PanelAnalysisRule<TContext>,
  second: PanelAnalysisRule<TContext>
): number {
  return (
    compareText(first.code, second.code) ||
    compareText(first.version, second.version)
  );
}

function compareFindings(
  first: PanelAnalysisFinding,
  second: PanelAnalysisFinding
): number {
  return (
    severityOrder[first.severity] - severityOrder[second.severity] ||
    compareText(first.category, second.category) ||
    (first.locations[0]?.sheetNumber ?? Number.MAX_SAFE_INTEGER) -
      (second.locations[0]?.sheetNumber ?? Number.MAX_SAFE_INTEGER) ||
    compareText(first.title, second.title) ||
    compareText(first.id, second.id)
  );
}

function failedOutcome<TContext>(
  rule: PanelAnalysisRule<TContext>
): PanelAnalysisRuleOutcome {
  return panelAnalysisRuleOutcomeSchema.parse({
    ruleCode: rule.code,
    ruleVersion: rule.version,
    category: rule.category,
    status: "not_evaluated",
    findingIds: [],
    notEvaluatedReason: "execution_failed",
    message: "The check could not be evaluated because its rule failed."
  });
}

export function runPanelAnalysisRules<TContext>({
  context,
  rules
}: {
  context: TContext;
  rules: readonly PanelAnalysisRule<TContext>[];
}): PanelAnalysisRuleRun {
  const findings: PanelAnalysisFinding[] = [];
  const outcomes: PanelAnalysisRuleOutcome[] = [];

  for (const rule of [...rules].sort(compareRules)) {
    try {
      const applicability = rule.isApplicable(context);

      if (!applicability.applicable) {
        outcomes.push(
          panelAnalysisRuleOutcomeSchema.parse({
            ruleCode: rule.code,
            ruleVersion: rule.version,
            category: rule.category,
            status: "not_evaluated",
            findingIds: [],
            notEvaluatedReason: "not_applicable",
            message: applicability.reason
          })
        );
        continue;
      }

      const evaluation = rule.evaluate(context);

      if (evaluation.status === "not_evaluated") {
        outcomes.push(
          panelAnalysisRuleOutcomeSchema.parse({
            ruleCode: rule.code,
            ruleVersion: rule.version,
            category: rule.category,
            status: "not_evaluated",
            findingIds: [],
            notEvaluatedReason: "insufficient_evidence",
            message: evaluation.reason
          })
        );
        continue;
      }

      if (evaluation.status === "passed") {
        outcomes.push(
          panelAnalysisRuleOutcomeSchema.parse({
            ruleCode: rule.code,
            ruleVersion: rule.version,
            category: rule.category,
            status: "passed",
            findingIds: [],
            message: evaluation.message
          })
        );
        continue;
      }

      const findingIds = new Set<string>();
      const ruleFindings = evaluation.findings.map(
        ({ findingKey, ...finding }) => {
          const id = `${rule.code}:${findingKey}`;
          if (findingIds.has(id)) {
            throw new Error(`Duplicate finding key: ${findingKey}`);
          }
          findingIds.add(id);

          return panelAnalysisFindingSchema.parse({
            ...finding,
            id,
            ruleCode: rule.code,
            ruleVersion: rule.version,
            category: rule.category
          });
        }
      );

      findings.push(...ruleFindings);
      outcomes.push(
        panelAnalysisRuleOutcomeSchema.parse({
          ruleCode: rule.code,
          ruleVersion: rule.version,
          category: rule.category,
          status: "finding",
          coverage: evaluation.coverage,
          findingIds: ruleFindings.map((finding) => finding.id)
        })
      );
    } catch {
      outcomes.push(failedOutcome(rule));
    }
  }

  findings.sort(compareFindings);

  return {
    findings,
    outcomes,
    coverage: buildPanelAnalysisCoverage(outcomes),
    summary: buildPanelAnalysisSummary(findings, outcomes)
  };
}
