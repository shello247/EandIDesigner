"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { loadPanelAnalysisBomAction } from "../../api/actions";
import {
  filterPanelAnalysisFindingGroups,
  type PanelAnalysisFindingFilters
} from "../../logic/services/panel-analysis-filtering";
import type {
  PanelAnalysisBomResult,
  PanelAnalysisResult,
  PanelAnalysisRuleOutcome
} from "../../types";
import { PanelAnalysisFilters } from "./panel-analysis-filters";
import { PanelAnalysisFindingList } from "./panel-analysis-finding-list";
import { PanelAnalysisSummary } from "./panel-analysis-summary";
import { PanelAnalysisScheduleSection } from "./panel-analysis-schedule-section";
import {PowerBudgetSection} from "./power-budget-section";
import {IoScheduleSection} from "./io-schedule-section";

const statusLabels = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
  archived: "Archived"
} as const;

const sectionLabels = [
  ["errors", "Error Detection"],
  ["power", "Power Budgets"],
  ["io", "I/O Schedule"],
  ["terminals", "Terminals"],
  ["wiring", "Internal Wiring"],
  ["assets", "Assets"],
  ["bom", "Materials / BOM"]
] as const;

type PanelAnalysisSection = (typeof sectionLabels)[number][0];
type PanelAnalysisBomState =
  | { status: "idle" | "loading" }
  | { status: "ready"; data: PanelAnalysisBomResult }
  | { status: "error"; message: string };

export function PanelAnalysisWorkspace({
  analysis
}: {
  analysis: PanelAnalysisResult;
}) {
  const [section, setSection] = useState<PanelAnalysisSection>("errors");
  const [filters, setFilters] = useState<PanelAnalysisFindingFilters>({});
  const [page, setPage] = useState(1);
  const [bomState, setBomState] = useState<PanelAnalysisBomState>({
    status: "idle"
  });
  const source = analysis.sourceRevision;
  const filteredGroups = useMemo(
    () =>
      filterPanelAnalysisFindingGroups({
        groups: analysis.findingGroups,
        findings: analysis.findings,
        filters
      }),
    [analysis.findingGroups, analysis.findings, filters]
  );
  const hasFilters = Object.values(filters).some((value) => Boolean(value));
  const unavailableOutcomes = analysis.outcomes.filter(
    (
      outcome
    ): outcome is Extract<PanelAnalysisRuleOutcome, { status: "not_evaluated" }> =>
      outcome.status === "not_evaluated" &&
      outcome.notEvaluatedReason !== "not_applicable"
  );
  const loadBom = async () => {
    if (bomState.status === "loading" || bomState.status === "ready") return;
    setBomState({ status: "loading" });
    const result = await loadPanelAnalysisBomAction({
      drawingId: source.drawingId,
      expectedUpdatedAt: source.savedAt
    });
    setBomState(
      result.ok
        ? { status: "ready", data: result.data }
        : { status: "error", message: result.error }
    );
  };

  const selectSection = (next: PanelAnalysisSection) => {
    setSection(next);
    if (next === "bom") void loadBom();
  };

  return (
    <div className="space-y-4">
      <Link
        href="/panel-analysis"
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-800"
      >
        <ArrowLeft aria-hidden="true" size={14} /> Panel Analysis drawings
      </Link>
      <header className="tool-panel flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
            Panel Analysis
          </p>
          <h1 className="mt-1 text-xl font-semibold">{source.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {source.project
              ? `${source.project.projectNumber ? `${source.project.projectNumber} — ` : ""}${source.project.name}`
              : "Unassigned drawing"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Saved {new Date(source.savedAt).toLocaleString()} · {statusLabels[source.status]}
          </p>
        </div>
        <Link href={`/drawings/${source.drawingId}`} className="icon-button">
          <ExternalLink aria-hidden="true" size={15} /> Open drawing
        </Link>
        <p className="w-full rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900">
          Analysis is based on the saved drawing revision.
        </p>
      </header>

      <div className="tool-panel overflow-hidden">
        <nav
          className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-2"
          aria-label="Panel Analysis sections"
        >
          {sectionLabels.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={[
                "whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold",
                section === value
                  ? "border-teal-600 text-teal-800"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              ].join(" ")}
              aria-current={section === value ? "page" : undefined}
              onClick={() => selectSection(value)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="p-5">
          {section === "errors" ? (
            <div className="space-y-5">
              <PanelAnalysisSummary
                summary={analysis.summary}
                coverage={analysis.coverage}
              />
              <PanelAnalysisFilters
                filters={filters}
                findings={analysis.findings}
                panels={analysis.panels}
                onChange={(next) => {
                  setFilters(next);
                  setPage(1);
                }}
                onReset={() => {
                  setFilters({});
                  setPage(1);
                }}
              />
              {unavailableOutcomes.length > 0 ? (
                <details className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-950">
                  <summary className="cursor-pointer font-bold">
                    {unavailableOutcomes.length} checks were not evaluated
                  </summary>
                  <ul className="mt-2 space-y-2 pl-4">
                    {unavailableOutcomes.map((outcome) => (
                      <li key={`${outcome.ruleCode}:${outcome.ruleVersion}`}>
                        <span className="font-semibold">{outcome.ruleCode}</span>: {outcome.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <PanelAnalysisFindingList
                drawingId={source.drawingId}
                items={filteredGroups}
                coverage={analysis.coverage}
                hasFilters={hasFilters}
                page={page}
                onPageChange={setPage}
              />
            </div>
          ) : section === "power" ? (
            <PowerBudgetSection analysis={analysis.powerAnalysis} />
          ) : section === "io" ? (
            <IoScheduleSection rows={analysis.ioSchedule}/>
          ) : section === "terminals" ? (
            <PanelAnalysisScheduleSection analysis={analysis} report="terminal_schedule" />
          ) : section === "wiring" ? (
            <PanelAnalysisScheduleSection analysis={analysis} report="internal_wire_schedule" />
          ) : section === "assets" ? (
            <PanelAnalysisScheduleSection analysis={analysis} report="panel_asset_schedule" />
          ) : (
            <PanelAnalysisScheduleSection
              analysis={analysis}
              report="bom"
              bom={bomState.status === "ready" ? bomState.data : undefined}
              bomLoading={bomState.status === "loading"}
              bomError={bomState.status === "error" ? bomState.message : undefined}
              onRetryBom={() => void loadBom()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
