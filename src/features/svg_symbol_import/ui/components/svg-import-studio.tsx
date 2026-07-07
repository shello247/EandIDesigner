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
import type { SvgImportPreview } from "../../types";
import { buildImportedSymbolMetadata } from "../../logic/use_cases/build-imported-symbol-metadata";
import { ImportAnchorReviewCanvas } from "./import-anchor-review-canvas";
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
  resizable: false
};

export function SvgImportStudio() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<SvgImportPreview | null>(null);
  const [form, setForm] = useState<SymbolMetadataFormState>(initialForm);
  const [anchors, setAnchors] = useState<SymbolAnchor[]>([]);
  const [terminals, setTerminals] = useState<SymbolTerminal[]>([]);
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

  const canSave =
    preview !== null &&
    form.displayName.trim().length > 0 &&
    form.symbolKey.trim().length > 0;

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
        setMessage(result.error);
        return;
      }

      const displayName = displayNameFromFile(result.data.sourceAsset.fileName);
      setPreview(result.data);
      setAnchors(result.data.anchors);
      setTerminals(result.data.terminals);
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
          terminals
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
              />
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
