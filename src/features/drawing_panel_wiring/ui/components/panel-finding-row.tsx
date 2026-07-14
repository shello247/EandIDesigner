import { MapPin, Wrench } from "lucide-react";
import type { PanelDrawingQualityFinding } from "../../data/schema";

const severityLabels: Record<PanelDrawingQualityFinding["severity"], string> = {
  blocking_error: "Blocking",
  warning: "Warning",
  information: "Information"
};

const severityClasses: Record<PanelDrawingQualityFinding["severity"], string> = {
  blocking_error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  information: "border-sky-200 bg-sky-50 text-sky-800"
};

export function formatPanelFindingCategory(
  category: PanelDrawingQualityFinding["category"]
): string {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function PanelFindingRow({
  finding,
  onNavigate,
  onRepair
}: {
  finding: PanelDrawingQualityFinding;
  onNavigate: (finding: PanelDrawingQualityFinding) => void;
  onRepair: (finding: PanelDrawingQualityFinding) => void;
}) {
  const sheets = [...new Map(
    finding.locations.map((location) => [location.sheetId, location])
  ).values()];
  const subject = [
    finding.assetTag,
    finding.terminal
      ? `${finding.terminal.terminalKey}/${finding.terminal.side}`
      : undefined,
    finding.wireId,
    finding.patternId
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr className="border-b border-slate-100 align-top hover:bg-slate-50/70">
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase ${severityClasses[finding.severity]}`}
        >
          {severityLabels[finding.severity]}
        </span>
      </td>
      <td className="px-3 py-3 text-xs font-semibold text-slate-700">
        {formatPanelFindingCategory(finding.category)}
      </td>
      <td className="px-3 py-3">
        <p className="text-xs font-medium leading-5 text-slate-900">
          {finding.message}
        </p>
        {subject ? (
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {subject}
          </p>
        ) : null}
        <p className="mt-1 font-mono text-[10px] text-slate-400">
          {finding.code}
        </p>
      </td>
      <td className="px-3 py-3 text-xs text-slate-600">
        {sheets.length > 0
          ? sheets
              .map((sheet) => `Sheet ${sheet.sheetNumber}: ${sheet.sheetName}`)
              .join(", ")
          : "Package record"}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="icon-button h-8"
            onClick={() => onNavigate(finding)}
          >
            <MapPin aria-hidden="true" size={13} />
            Go to
          </button>
          {finding.repair ? (
            <button
              type="button"
              className="icon-button h-8"
              onClick={() => onRepair(finding)}
            >
              <Wrench aria-hidden="true" size={13} />
              Repair
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
