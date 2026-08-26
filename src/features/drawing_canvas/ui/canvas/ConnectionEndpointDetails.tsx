import { getDrawingAnchorAvailabilityLabel } from "../../logic/services/drawing-anchor-availability";
import type { AnchorHotspot, DrawingAnchorInspection } from "./types";
import type { ReactNode } from "react";

const AVAILABLE_ANCHOR = {
  status: "available" as const,
  enabled: true,
  occupants: []
};

export function buildDrawingAnchorInspection({
  hotspot,
  availability = AVAILABLE_ANCHOR
}: {
  hotspot: AnchorHotspot;
  availability?: DrawingAnchorInspection["availability"];
}): DrawingAnchorInspection {
  return {
    id: hotspot.id,
    endpoint: {
      placementId: hotspot.placementId,
      anchorKey: hotspot.anchor.key
    },
    placementTag: hotspot.placementTag,
    symbolName: hotspot.symbolName,
    symbolModel: hotspot.symbolModel ?? undefined,
    anchorKey: hotspot.anchor.key,
    anchorKind: hotspot.anchor.kind,
    terminalKey: hotspot.terminal?.key,
    terminalLabel: hotspot.terminal?.label,
    terminalFunction: hotspot.terminal?.function,
    requiredForWiring: hotspot.terminal?.requiredForWiring,
    memberToken: hotspot.memberToken,
    memberPurpose: hotspot.memberPurpose,
    availability
  };
}

function statusClasses(status: DrawingAnchorInspection["availability"]["status"]): string {
  if (status === "available") return "bg-emerald-50 text-emerald-700";
  if (status === "occupied") return "bg-teal-100 text-teal-900";
  if (status === "conflicting") return "bg-rose-100 text-rose-800";
  return "bg-slate-200 text-slate-700";
}

function DetailRow({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function ConnectionEndpointDetails({
  inspection,
  showAvailability = true
}: {
  inspection: DrawingAnchorInspection;
  showAvailability?: boolean;
}) {
  const occupant = inspection.availability.occupants[0];

  return (
    <div data-testid="connection-endpoint-details">
      {showAvailability ? (
        <div
          className={[
            "mb-2 inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
            statusClasses(inspection.availability.status)
          ].join(" ")}
        >
          {getDrawingAnchorAvailabilityLabel(inspection.availability)}
        </div>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-950">
            {inspection.placementTag}
          </div>
          <div className="truncate text-[10px] font-medium text-slate-500">
            {inspection.symbolName}
          </div>
        </div>
        <div className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
          {inspection.requiredForWiring ? "Required" : "Reference"}
        </div>
      </div>
      <dl className="space-y-1.5">
        <DetailRow label="Anchor">{inspection.anchorKey}</DetailRow>
        <DetailRow label="Type">
          <span className="capitalize">{inspection.anchorKind}</span>
        </DetailRow>
        <DetailRow label="Terminal">{inspection.terminalKey ?? "-"}</DetailRow>
        <DetailRow label="Label">{inspection.terminalLabel ?? "-"}</DetailRow>
        <DetailRow label="Function">
          {inspection.terminalFunction ?? "-"}
        </DetailRow>
        {inspection.memberPurpose ? (
          <DetailRow label="Purpose">
            {inspection.memberToken ? (
              <span className="mr-1 font-mono text-[10px] font-semibold text-slate-500">
                {inspection.memberToken}
              </span>
            ) : null}
            {inspection.memberPurpose}
          </DetailRow>
        ) : null}
        {inspection.symbolModel ? (
          <DetailRow label="Model">{inspection.symbolModel}</DetailRow>
        ) : null}
        {inspection.availability.reason &&
        inspection.availability.status !== "available" ? (
          <DetailRow label="Status">{inspection.availability.reason}</DetailRow>
        ) : null}
        {occupant?.wireId ? (
          <DetailRow label="Wire ID">{occupant.wireId}</DetailRow>
        ) : null}
        {occupant?.cableTag ? (
          <DetailRow label="Cable">
            {occupant.cableTag}
            {occupant.conductorKey ? ` / ${occupant.conductorKey}` : ""}
          </DetailRow>
        ) : null}
        {occupant?.sourceSheet ? (
          <DetailRow label="Source">{occupant.sourceSheet}</DetailRow>
        ) : null}
      </dl>
    </div>
  );
}
