import {
  AlertOctagon,
  AlertTriangle,
  CircleDashed,
  CircleHelp,
  Info
} from "lucide-react";
import type {
  PanelAnalysisCoverage,
  PanelAnalysisSummary as PanelAnalysisSummaryData
} from "../../types";

const coverageLabels = {
  complete: "Complete",
  partial: "Partial",
  not_evaluated: "Not evaluated"
} as const;

export function PanelAnalysisSummary({
  summary,
  coverage
}: {
  summary: PanelAnalysisSummaryData;
  coverage: PanelAnalysisCoverage;
}) {
  const cards = [
    { label: "Errors", value: summary.errors, icon: AlertOctagon, tone: "border-red-200 bg-red-50 text-red-800" },
    { label: "Warnings", value: summary.warnings, icon: AlertTriangle, tone: "border-amber-200 bg-amber-50 text-amber-800" },
    { label: "Data gaps", value: summary.dataGaps, icon: CircleDashed, tone: "border-sky-200 bg-sky-50 text-sky-800" },
    { label: "Information", value: summary.information, icon: Info, tone: "border-slate-200 bg-slate-50 text-slate-700" },
    { label: "Checks not evaluated", value: summary.checksNotEvaluated, icon: CircleHelp, tone: "border-violet-200 bg-violet-50 text-violet-800" }
  ];

  return (
    <section aria-labelledby="panel-analysis-summary-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="panel-analysis-summary-title" className="text-base font-bold">Error Detection</h2>
          <p className="mt-1 text-xs text-slate-500">
            {summary.totalFindings} findings from {coverage.applicableRules} applicable checks.
          </p>
        </div>
        <span className={[
          "rounded-full border px-3 py-1 text-xs font-bold",
          coverage.status === "complete"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : coverage.status === "partial"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-violet-200 bg-violet-50 text-violet-800"
        ].join(" ")}>
          Coverage: {coverageLabels[coverage.status]}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-lg border p-3 ${card.tone}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{card.label}</span>
                <Icon aria-hidden="true" size={16} />
              </div>
              <strong className="mt-2 block text-2xl tabular-nums">{card.value}</strong>
            </div>
          );
        })}
      </div>
      {coverage.status !== "complete" ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {coverage.unavailableRules} applicable {coverage.unavailableRules === 1 ? "check was" : "checks were"} not evaluated.
          {Boolean(coverage.partialRules) && ` ${coverage.partialRules} additional ${coverage.partialRules === 1 ? "check has" : "checks have"} partial or provisional evidence.`}
          {" Complete engineering coverage has not been established."}
        </div>
      ) : null}
    </section>
  );
}
