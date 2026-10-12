import { RotateCcw } from "lucide-react";
import { SearchInput } from "@/shared/ui/search-input";
import type { PanelAnalysisFindingFilters } from "../../logic/services/panel-analysis-filtering";
import type {
  PanelAnalysisCategory,
  PanelAnalysisFinding,
  PanelAnalysisPanelSummary,
  PanelAnalysisSeverity
} from "../../types";

const severityOptions: Array<{ value: PanelAnalysisSeverity; label: string }> = [
  { value: "error", label: "Errors" },
  { value: "warning", label: "Warnings" },
  { value: "data_gap", label: "Data gaps" },
  { value: "information", label: "Information" }
];

const categoryLabels: Record<PanelAnalysisCategory, string> = {
  structural_identity: "Structural identity",
  connectivity: "Connectivity",
  terminal_occupancy: "Terminal occupancy",
  external_termination: "External terminations",
  internal_wiring: "Internal wiring",
  cable_conductor: "Cables and conductors",
  instrument_loop: "Instrument loops",
  signal_compatibility: "Signal compatibility",
  documentation: "Documentation",
  shield_earth: "Shield and earth",
  engineering_metadata: "Engineering metadata",
  power_budget: "Power budgets",
  dimension_consistency: "Physical dimensions",
  analysis_coverage: "Analysis coverage"
};

export function panelAnalysisCategoryLabel(category: PanelAnalysisCategory): string {
  return categoryLabels[category];
}

export function PanelAnalysisFilters({
  filters,
  findings,
  panels,
  onChange,
  onReset
}: {
  filters: PanelAnalysisFindingFilters;
  findings: readonly PanelAnalysisFinding[];
  panels: readonly PanelAnalysisPanelSummary[];
  onChange: (next: PanelAnalysisFindingFilters) => void;
  onReset: () => void;
}) {
  const sheets = [...new Map(
    findings.flatMap((finding) =>
      finding.locations.map((location) => [location.sheetId, location])
    )
  ).values()].sort((first, second) => first.sheetNumber - second.sheetNumber);
  const assets = [...new Map(
    findings.flatMap((finding) =>
      finding.affectedRecords.flatMap((record) =>
        record.assetId
          ? [[record.assetId, record.label ?? record.assetId] as const]
          : record.kind === "asset"
            ? [[record.id, record.label ?? record.id] as const]
            : []
      )
    )
  ).entries()].sort((first, second) =>
    first[1].localeCompare(second[1], undefined, { numeric: true })
  );
  const categories = [...new Set(findings.map((finding) => finding.category))]
    .sort((first, second) => categoryLabels[first].localeCompare(categoryLabels[second]));

  const set = <Key extends keyof PanelAnalysisFindingFilters>(
    key: Key,
    value: PanelAnalysisFindingFilters[Key]
  ) => onChange({ ...filters, [key]: value || undefined });

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="Finding filters">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="xl:col-span-2">
          <span className="field-label">Search findings</span>
          <SearchInput value={filters.query ?? ""} onChange={(event) => set("query", event.target.value)} placeholder="Problem, tag, wire, code, or sheet" />
        </label>
        <label>
          <span className="field-label">Panel</span>
          <select className="field-input" value={filters.panelAssetId ?? ""} onChange={(event) => set("panelAssetId", event.target.value)}>
            <option value="">Entire package</option>
            {panels.map((panel) => <option key={panel.assetId} value={panel.assetId}>{panel.tag} — {panel.title}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">Severity</span>
          <select className="field-input" value={filters.severity ?? ""} onChange={(event) => set("severity", event.target.value as PanelAnalysisSeverity)}>
            <option value="">All severities</option>
            {severityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">Category</span>
          <select className="field-input" value={filters.category ?? ""} onChange={(event) => set("category", event.target.value as PanelAnalysisCategory)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">Sheet</span>
          <select className="field-input" value={filters.sheetId ?? ""} onChange={(event) => set("sheetId", event.target.value)}>
            <option value="">All sheets</option>
            {sheets.map((sheet) => <option key={sheet.sheetId} value={sheet.sheetId}>Sheet {sheet.sheetNumber}{sheet.sheetName ? ` — ${sheet.sheetName}` : ""}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <label className="w-full md:max-w-sm">
          <span className="field-label">Asset</span>
          <select className="field-input" value={filters.assetId ?? ""} onChange={(event) => set("assetId", event.target.value)}>
            <option value="">All assets</option>
            {assets.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="icon-button" onClick={onReset}>
          <RotateCcw aria-hidden="true" size={14} /> Clear filters
        </button>
      </div>
    </section>
  );
}
