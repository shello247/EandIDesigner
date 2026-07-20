"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import type {
  SymbolAnchor,
  SymbolMetadata,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";
import {
  parseSvgImportPreviewAction,
  saveImportedSvgSymbolAction
} from "../../api/actions";
import type { SvgImportNetworkProfileDraft } from "../../data/schema";
import type { SvgImportPreview } from "../../types";
import { buildImportedSymbolMetadata } from "../../logic/use_cases/build-imported-symbol-metadata";
import { isNetworkProfileDraftComplete } from "../../logic/services/network-profile-draft";
import { ImportAnchorReviewCanvas } from "./import-anchor-review-canvas";
import { NetworkPortEditor } from "./network-port-editor";
import { NetworkProfileEditor } from "./network-profile-editor";
import { SvgImportActions } from "./svg-import-actions";
import { SvgImportPanel } from "./svg-import-panel";
import {
  SymbolMetadataForm,
  type SymbolMetadataFormState
} from "./symbol-metadata-form";
import { TerminalAnchorEditor } from "./terminal-anchor-editor";

function symbolKeyFromName(value: string): string {
  const normalized = value
    .replace(/\.svg$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "imported_symbol";
}

function displayNameFromFile(value: string): string {
  return value
    .replace(/\.svg$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const initialForm: SymbolMetadataFormState = {
  symbolKey: "",
  displayName: "",
  manufacturer: "",
  model: "",
  category: "instrument",
  layoutUsage: "wiring",
  physicalWidthMm: "",
  physicalHeightMm: "",
  mountingType: "",
  panelCategory: "",
  resizable: false,
  panelWiringEnabled: false,
  panelWiringAssetType: "other",
  panelWiringTagPrefix: "EQ",
  panelWiringSchematicScale: ""
};

const initialNetworkProfile: SvgImportNetworkProfileDraft = {
  deviceType: "",
  managed: undefined,
  ports: []
};

export function SvgImportStudio() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<SvgImportPreview | null>(null);
  const [form, setForm] = useState<SymbolMetadataFormState>(initialForm);
  const [anchors, setAnchors] = useState<SymbolAnchor[]>([]);
  const [terminals, setTerminals] = useState<SymbolTerminal[]>([]);
  const [networkProfile, setNetworkProfile] =
    useState<SvgImportNetworkProfileDraft>(initialNetworkProfile);
  const [message, setMessage] = useState<string | null>(null);

  const metadataPreview = useMemo(() => {
    if (!preview) {
      return null;
    }

    return {
      viewBox: preview.viewBox,
      anchors
    };
  }, [anchors, preview]);

  const networkProfileReady =
    form.category !== "network_device" ||
    isNetworkProfileDraftComplete(networkProfile);
  const canSave =
    preview !== null &&
    form.displayName.trim().length > 0 &&
    form.symbolKey.trim().length > 0 &&
    networkProfileReady;

  const parseFile = (file: File) => {
    startTransition(async () => {
      setMessage(null);
      const formData = new FormData();
      formData.set("svgFile", file);
      const result = await parseSvgImportPreviewAction(formData);

      if (!result.ok) {
        setPreview(null);
        setAnchors([]);
        setTerminals([]);
        setNetworkProfile((current) => ({ ...current, ports: [] }));
        setMessage(result.error);
        return;
      }

      const displayName = displayNameFromFile(result.data.sourceAsset.fileName);
      setPreview(result.data);
      setAnchors(result.data.anchors);
      setTerminals(result.data.terminals);
      setNetworkProfile((current) => ({
        ...current,
        ports: result.data.networkPorts
      }));
      setForm((current) => ({
        ...current,
        displayName: current.displayName || displayName,
        symbolKey: current.symbolKey || symbolKeyFromName(displayName)
      }));
      setMessage(
        result.data.issues.length > 0
          ? "SVG imported with sanitizer notes. Review validation after saving."
          : "SVG imported. Review metadata, anchors, and terminals before saving."
      );
    });
  };

  const saveImport = () => {
    if (!preview) {
      return;
    }

    startTransition(async () => {
      setMessage(null);

      let metadata: SymbolMetadata;
      try {
        metadata = buildImportedSymbolMetadata({
          ...form,
          viewBox: preview.viewBox,
          anchors,
          terminals,
          networkProfile
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Metadata is invalid.");
        return;
      }

      const result = await saveImportedSvgSymbolAction({
        svg: preview.svg,
        sourceAsset: preview.sourceAsset,
        metadata
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      router.push(`/symbols/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <SvgImportActions
        canSave={canSave}
        isPending={isPending}
        onSave={saveImport}
      />

      {message ? (
        <div className="tool-panel flex items-start gap-2 p-4 text-sm text-slate-700">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 text-teal-700"
            size={17}
          />
          <span>{message}</span>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-5">
          <SvgImportPanel
            preview={preview}
            isPending={isPending}
            onFileSelected={parseFile}
          />
          <SymbolMetadataForm
            form={form}
            disabled={isPending}
            onChange={(updates) =>
              setForm((current) => ({
                ...current,
                ...updates
              }))
            }
          />
          {form.category === "network_device" ? (
            <NetworkProfileEditor
              profile={networkProfile}
              disabled={isPending}
              onChange={(updates) =>
                setNetworkProfile((current) => ({
                  ...current,
                  ...updates
                }))
              }
            />
          ) : null}
        </div>

        <div className="space-y-5">
          {preview && metadataPreview ? (
            <>
              <ImportAnchorReviewCanvas
                svg={preview.svg}
                metadata={metadataPreview}
                onAnchorMove={(key, x, y) =>
                  setAnchors((current) =>
                    current.map((anchor) =>
                      anchor.key === key ? { ...anchor, x, y } : anchor
                    )
                  )
                }
              />
              <TerminalAnchorEditor
                viewBox={preview.viewBox}
                anchors={anchors}
                terminals={terminals}
                disabled={isPending}
                onAnchorsChange={setAnchors}
                onTerminalsChange={setTerminals}
                onAnchorRenamed={(previousKey, nextKey) =>
                  setNetworkProfile((current) => ({
                    ...current,
                    ports: current.ports.map((port) =>
                      port.anchorKey === previousKey
                        ? { ...port, anchorKey: nextKey }
                        : port
                    )
                  }))
                }
              />
              {form.category === "network_device" ? (
                <NetworkPortEditor
                  anchors={anchors}
                  ports={networkProfile.ports}
                  disabled={isPending}
                  onChange={(ports) =>
                    setNetworkProfile((current) => ({ ...current, ports }))
                  }
                />
              ) : null}
            </>
          ) : (
            <div className="tool-panel flex min-h-[520px] items-center justify-center p-8 text-center">
              <div>
                <h2 className="text-lg font-bold">No SVG imported</h2>
                <p className="mt-2 max-w-md text-sm text-slate-600">
                  Select an SVG file to start the device symbol import.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
