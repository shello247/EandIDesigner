"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";
import { AlertTriangle, Save, X } from "lucide-react";
import type { ComponentAlternativeCandidate } from "@/features/symbol_components/api/public";
import type { SymbolCategoryRecord } from "@/features/symbol_categories/api/public";
import type { SymbolCategoryManagerUpdate } from "@/features/symbol_categories/ui/components/symbol-category-manager";
import { saveSymbolMetadataChangesAction } from "../../api/actions";
import type { SymbolMetadata } from "../../data/schema";
import {
  buildNetworkProfileFromReviewDraft,
  createNetworkProfileReviewDraft,
  type NetworkProfileReviewDraft
} from "../../logic/services/network-profile-review-draft";
import type { SymbolDetail, SymbolVersionSummary } from "../../types";
import { ApprovalBar } from "./approval-bar";
import styles from "./symbol-detail-workspace.module.css";
import { SymbolWorkspaceTabs } from "./symbol-workspace-tabs";

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatDimension(value: number | undefined): string {
  return value === undefined ? "not set" : `${value} mm`;
}

export function SymbolMetadataEditor({
  symbol,
  latest,
  componentAlternatives,
  categories,
  onSavedRegistryDetails
}: {
  symbol: SymbolDetail;
  latest: SymbolVersionSummary;
  componentAlternatives: ComponentAlternativeCandidate[];
  categories: SymbolCategoryRecord[];
  onSavedRegistryDetails?: (details: {
    displayName: string;
    description?: string;
  }) => void;
}) {
  const [isSaving, startSaving] = useTransition();
  const [baselineMetadata, setBaselineMetadata] = useState(latest.metadata);
  const [draftMetadata, setDraftMetadata] = useState(latest.metadata);
  const [baselineCategoryId, setBaselineCategoryId] = useState(
    symbol.category.id
  );
  const [categoryId, setCategoryId] = useState(symbol.category.id);
  const [availableCategories, setAvailableCategories] = useState(categories);
  const [baselineManufacturer, setBaselineManufacturer] = useState(
    symbol.manufacturer ?? ""
  );
  const [manufacturer, setManufacturer] = useState(symbol.manufacturer ?? "");
  const [baselineModel, setBaselineModel] = useState(symbol.model ?? "");
  const [model, setModel] = useState(symbol.model ?? "");
  const [baselineNetworkDraft, setBaselineNetworkDraft] =
    useState<NetworkProfileReviewDraft>(() =>
      createNetworkProfileReviewDraft(latest.metadata.networkProfile)
    );
  const [networkDraft, setNetworkDraft] = useState<NetworkProfileReviewDraft>(
    () => createNetworkProfileReviewDraft(latest.metadata.networkProfile)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState(
    symbol.validationIssues
  );
  const [confirmingDimensions, setConfirmingDimensions] = useState(false);
  const blockingIssueCount = validationIssues.filter(
    (issue) => issue.severity === "blocking"
  ).length;
  const archived = symbol.status === "archived";
  const networkSymbol = symbol.technicalKind === "network_device";
  const metadataDirty = useMemo(
    () =>
      !sameValue(draftMetadata, baselineMetadata) ||
      categoryId !== baselineCategoryId ||
      (networkSymbol &&
        (manufacturer !== baselineManufacturer ||
          model !== baselineModel ||
          !sameValue(networkDraft, baselineNetworkDraft))),
    [
      baselineManufacturer,
      baselineCategoryId,
      baselineMetadata,
      baselineModel,
      baselineNetworkDraft,
      draftMetadata,
      categoryId,
      manufacturer,
      model,
      networkDraft,
      networkSymbol
    ]
  );
  const dimensionsChanged =
    draftMetadata.physicalWidthMm !== baselineMetadata.physicalWidthMm ||
    draftMetadata.physicalHeightMm !== baselineMetadata.physicalHeightMm;

  useEffect(() => {
    if (!metadataDirty) {
      return;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [metadataDirty]);

  const updateMetadata = useCallback(
    (updater: (current: SymbolMetadata) => SymbolMetadata) => {
      setMessage(null);
      setDraftMetadata((current) => updater(current));
    },
    []
  );

  const performSave = () => {
    setConfirmingDimensions(false);
    setMessage(null);

    let networkProfile = draftMetadata.networkProfile;
    if (networkSymbol) {
      try {
        networkProfile = buildNetworkProfileFromReviewDraft(networkDraft);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Network profile is invalid."
        );
        return;
      }
    }

    startSaving(async () => {
      const result = await saveSymbolMetadataChangesAction({
        symbolId: symbol.id,
        versionId: latest.id,
        categoryId,
        registryDetails: {
          displayName: draftMetadata.displayName,
          description: draftMetadata.description
        },
        layout: {
          layoutUsage: draftMetadata.layoutUsage ?? "wiring",
          physicalWidthMm: draftMetadata.physicalWidthMm,
          physicalHeightMm: draftMetadata.physicalHeightMm,
          mountingType: draftMetadata.mountingType,
          resizable: draftMetadata.resizable ?? false,
          terminalBlockModule: draftMetadata.terminalBlockModule,
          terminalStripCapability: draftMetadata.terminalStripCapability
        },
        panelWiring: draftMetadata.panelWiring,
        electricalTopology: draftMetadata.electricalTopology,
        terminals: draftMetadata.terminals,
        componentPositions: draftMetadata.componentPositions,
        networkProfile,
        networkIdentity: networkSymbol
          ? {
              manufacturer,
              model
            }
          : undefined
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      const savedMetadata =
        result.data.latestVersion?.metadata ?? draftMetadata;
      const savedManufacturer = result.data.manufacturer ?? "";
      const savedModel = result.data.model ?? "";
      const savedNetworkDraft = createNetworkProfileReviewDraft(
        savedMetadata.networkProfile
      );

      setBaselineMetadata(savedMetadata);
      setDraftMetadata(savedMetadata);
      setBaselineCategoryId(result.data.category.id);
      setCategoryId(result.data.category.id);
      setBaselineManufacturer(savedManufacturer);
      setManufacturer(savedManufacturer);
      setBaselineModel(savedModel);
      setModel(savedModel);
      setBaselineNetworkDraft(savedNetworkDraft);
      setNetworkDraft(savedNetworkDraft);
      setValidationIssues(result.data.validationIssues);
      onSavedRegistryDetails?.({
        displayName: savedMetadata.displayName,
        description: savedMetadata.description
      });
      setMessage("Symbol metadata saved.");
    });
  };

  const requestSave = () => {
    if (!metadataDirty || archived || isSaving) {
      return;
    }

    if (dimensionsChanged) {
      setConfirmingDimensions(true);
      return;
    }

    performSave();
  };

  const handleCategoriesUpdated = useCallback(
    (update: SymbolCategoryManagerUpdate) => {
      setAvailableCategories(update.categories);

      if (!update.deletedCategoryId) {
        return;
      }

      const deletedCategoryId = update.deletedCategoryId;
      const replacementCategoryId = update.replacementCategoryId;
      const deletedBaselineCategory =
        baselineCategoryId === deletedCategoryId;

      if (deletedBaselineCategory && replacementCategoryId) {
        setBaselineCategoryId(replacementCategoryId);
      }

      setCategoryId((current) => {
        if (current !== deletedCategoryId) {
          return current;
        }

        return deletedBaselineCategory && replacementCategoryId
          ? replacementCategoryId
          : baselineCategoryId;
      });
    },
    [baselineCategoryId]
  );

  return (
    <div className={`flex min-h-0 flex-col gap-5 ${styles.editor}`}>
      <div className={styles.approvalBar}>
        <ApprovalBar
          symbolId={symbol.id}
          versionId={latest.id}
          status={symbol.status}
          blockingIssueCount={blockingIssueCount}
          metadataDirty={metadataDirty}
          metadataSaving={isSaving}
          metadataMessage={message}
          onSaveMetadata={requestSave}
        />
      </div>
      <SymbolWorkspaceTabs
        symbol={symbol}
        latest={latest}
        metadata={draftMetadata}
        categories={availableCategories}
        categoryId={categoryId}
        componentAlternatives={componentAlternatives}
        manufacturer={manufacturer}
        model={model}
        networkDraft={networkDraft}
        validationIssues={validationIssues}
        readOnly={archived}
        onMetadataChange={updateMetadata}
        onCategoryChange={(value) => {
          setMessage(null);
          setCategoryId(value);
        }}
        onCategoriesUpdated={handleCategoriesUpdated}
        onManufacturerChange={(value) => {
          setMessage(null);
          setManufacturer(value);
        }}
        onModelChange={(value) => {
          setMessage(null);
          setModel(value);
        }}
        onNetworkDraftChange={(draft) => {
          setMessage(null);
          setNetworkDraft(draft);
        }}
      />

      {confirmingDimensions ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="symbol-dimension-confirmation-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2
                  id="symbol-dimension-confirmation-title"
                  className="text-[15px] font-semibold"
                >
                  Save physical dimension changes?
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Existing panel layouts pinned to this symbol version may use
                  the updated physical size.
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close dimension confirmation"
                onClick={() => setConfirmingDimensions(false)}
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                  size={15}
                />
                This saves metadata only. It does not move or rescale
                existing drawing placements by itself.
              </div>
              <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-sm">
                <dt className="font-semibold">Width</dt>
                <dd className="text-slate-500">
                  {formatDimension(baselineMetadata.physicalWidthMm)}
                </dd>
                <dd>{formatDimension(draftMetadata.physicalWidthMm)}</dd>
                <dt className="font-semibold">Height</dt>
                <dd className="text-slate-500">
                  {formatDimension(baselineMetadata.physicalHeightMm)}
                </dd>
                <dd>{formatDimension(draftMetadata.physicalHeightMm)}</dd>
              </dl>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                type="button"
                className="icon-button"
                onClick={() => setConfirmingDimensions(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="icon-button icon-button-primary"
                onClick={performSave}
              >
                <Save aria-hidden="true" size={14} />
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
