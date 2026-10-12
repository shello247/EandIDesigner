import { z } from "zod";
import { deviceTypeSchema, type DeviceType } from "./device-types";

export const classificationSourceSchema = z.strictObject({
  kind: z.enum(["item_revision", "symbol_version", "managed_asset", "drawing_snapshot", "legacy_metadata"]),
  recordId: z.string().min(1),
  revisionId: z.string().min(1),
  deviceType: deviceTypeSchema.nullable()
});
export type ClassificationSource = z.infer<typeof classificationSourceSchema>;
export type ClassificationLookup =
  | { state: "available"; source: ClassificationSource }
  | { state: "unavailable"; recordId: string; revisionId: string; reason: string };
export type ClassificationIssue = {
  code: "missing_type" | "source_unavailable" | "conflicting_types" | "snapshot_mismatch";
  message: string;
  source?: ClassificationSource;
};
export type ClassificationResolution = {
  status: "resolved" | "needs_classification" | "conflicting" | "unavailable";
  deviceType: DeviceType | null;
  source: ClassificationSource | null;
  issues: ClassificationIssue[];
  proposedType: DeviceType | null;
};

/** Pure, exact-revision resolution. Callers must never substitute latest rows.
 * A selected but missing Item blocks fallback to the Symbol. Stored snapshots
 * and legacy metadata are evidence, not alternative authorities.
 */
export function resolveDeviceClassification(input: {
  item?: ClassificationLookup;
  symbol?: ClassificationLookup;
  unlinkedAsset?: ClassificationSource;
  evidence?: readonly ClassificationSource[];
}): ClassificationResolution {
  const selected = input.item ?? input.symbol ?? (input.unlinkedAsset
    ? { state: "available" as const, source: input.unlinkedAsset } : undefined);
  if (selected?.state === "unavailable") return {
    status: "unavailable", deviceType: null, source: null, proposedType: null,
    issues: [{ code: "source_unavailable", message:
      `Cannot read ${selected.recordId} revision ${selected.revisionId}: ${selected.reason}` }]
  };
  const source = selected?.state === "available" ? selected.source : null;
  const evidence = [...(input.evidence ?? [])];
  if (input.item && input.symbol?.state === "available") evidence.push(input.symbol.source);
  const type = source?.deviceType ?? null;
  const issues: ClassificationIssue[] = [];
  const specificEvidence = evidence.filter(entry => entry.deviceType && entry.deviceType !== "other");
  if (!type) {
    const candidates = new Set(specificEvidence.map(entry => entry.deviceType));
    return {
      status: candidates.size > 1 ? "conflicting" : "needs_classification",
      deviceType: null, source, proposedType: candidates.size === 1 ? [...candidates][0] : null,
      issues: [{ code: candidates.size > 1 ? "conflicting_types" : "missing_type",
        message: candidates.size > 1 ? "Existing classification evidence disagrees; review the exact records."
          : "Choose an explicit Device Type on the source record; legacy evidence has not been adopted." }]
    };
  }
  for (const entry of evidence) {
    if (!entry.deviceType || entry.deviceType === type) continue;
    // Legacy Other often means no classification, unlike deliberately selected Other.
    if (entry.deviceType === "other" && entry.kind !== "symbol_version") {
      if (entry.kind === "drawing_snapshot") issues.push({ code: "snapshot_mismatch",
        message: "Saved drawing type differs from the pinned source; review before reconciling.", source: entry });
      continue;
    }
    issues.push({ code: "conflicting_types", message:
      `${entry.kind} ${entry.recordId} revision ${entry.revisionId} records ${entry.deviceType}, not ${type}.`, source: entry });
  }
  if (input.item && input.symbol?.state === "unavailable") issues.push({ code: "source_unavailable",
    message: `The pinned Symbol version ${input.symbol.revisionId} is unavailable; compatibility cannot be checked.` });
  return { status: issues.some(issue => issue.code === "conflicting_types") ? "conflicting" : "resolved",
    deviceType: type, source, issues, proposedType: issues.some(issue => issue.code === "snapshot_mismatch") ? type : null };
}
