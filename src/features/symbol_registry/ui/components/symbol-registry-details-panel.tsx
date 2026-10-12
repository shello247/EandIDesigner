"use client";

import type { SymbolMetadata } from "../../data/schema";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getDeviceTypeLabel, type DeviceType } from "@/shared/device-classification/device-types";
const ClassificationReviewDialog = dynamic(() => import("@/features/device_classification/api/ui").then(module => module.ClassificationReviewDialog));

export function SymbolRegistryDetailsPanel({
  metadata,
  versionId,
  deviceType,
  classificationBlocked,
  readOnly,
  onChange
}: {
  metadata: SymbolMetadata;
  versionId: string;
  deviceType?: DeviceType | null;
  classificationBlocked: boolean;
  readOnly: boolean;
  onChange: (updater: (current: SymbolMetadata) => SymbolMetadata) => void;
}) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [savedType, setSavedType] = useState(deviceType);
  const [message, setMessage] = useState("");
  return (
    <section className="tool-panel p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Symbol Details</h2>
        <p className="mt-1 text-xs text-slate-500">
          Registry name and optional engineering description.
        </p>
      </div>
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="field-label">Name</span>
          <input
            className="field-input"
            aria-label="Symbol name"
            value={metadata.displayName}
            maxLength={200}
            disabled={readOnly}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange((current) => ({
                ...current,
                displayName: value
              }));
            }}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><span className="field-label">Device Type</span><p className="text-sm">{getDeviceTypeLabel(savedType)}</p></div>
          <button type="button" className="icon-button" disabled={readOnly || classificationBlocked}
            title={classificationBlocked ? "Save detail changes before reviewing classification." : undefined}
            onClick={() => setReviewing(true)}>Review classification</button>
        </div>
        {message ? <p role="status" className="text-xs text-teal-800">{message}</p> : null}
        {reviewing ? <ClassificationReviewDialog versionId={versionId} onClose={() => setReviewing(false)} onSaved={type => {
          setSavedType(type); setReviewing(false); setMessage("Classification saved. Existing drawing snapshots are unchanged."); router.refresh();
        }} /> : null}
        <label className="grid gap-1.5">
          <span className="field-label">Description</span>
          <textarea
            className="field-input min-h-24 resize-y"
            aria-label="Symbol description"
            value={metadata.description ?? ""}
            maxLength={400}
            disabled={readOnly}
            placeholder="Optional engineering description"
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange((current) => ({
                ...current,
                description: value
              }));
            }}
          />
          <span className="text-right text-[11px] text-slate-400">
            {(metadata.description ?? "").length}/400
          </span>
        </label>
      </div>
    </section>
  );
}
