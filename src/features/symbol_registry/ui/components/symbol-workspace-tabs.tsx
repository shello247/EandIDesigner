"use client";

import { useState, useSyncExternalStore } from "react";
import { FileText, LayoutDashboard, NotebookPen, PackageSearch } from "lucide-react";
import type { SymbolDetail, SymbolVersionSummary } from "../../types";
import type { SymbolMetadata } from "../../data/schema";
import type { ValidationIssue } from "../../data/schema";
import type { NetworkProfileReviewDraft } from "../../logic/services/network-profile-review-draft";
import { EngineerNotesPanel } from "./engineer-notes-panel";
import { NetworkProfilePanel } from "./network-profile-panel";
import { SvgPreviewPanel } from "./svg-preview-panel";
import { SymbolDocumentsPanel } from "./symbol-documents-panel";
import { SymbolLayoutMetadataPanel } from "./symbol-layout-metadata-panel";
import { SymbolPanelWiringCapabilityPanel } from "./symbol-panel-wiring-capability-panel";
import { SymbolElectricalTopologyPanel } from "./symbol-electrical-topology-panel";
import { SymbolRegistryDetailsPanel } from "./symbol-registry-details-panel";
import { TerminalMapTable } from "./terminal-map-table";
import { ValidationPanel } from "./validation-panel";
import type { ComponentAlternativeCandidate } from "@/features/symbol_components/api/public";
import { SymbolComponentsPanel } from "@/features/symbol_components/ui/components/symbol-components-panel";
import { SymbolBomPanelLoader } from "@/features/bom_creator/ui/components/symbol-bom-panel-loader";
import type { SymbolCategoryRecord } from "@/features/symbol_categories/api/public";
import type { SymbolCategoryManagerUpdate } from "@/features/symbol_categories/ui/components/symbol-category-manager";
import styles from "./symbol-detail-workspace.module.css";

type WorkspaceTab = "overview" | "bom" | "engineer_notes" | "documents";

const baseTabs: Array<{
  key: WorkspaceTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "engineer_notes", label: "Engineer Notes", icon: NotebookPen },
  { key: "documents", label: "Documents", icon: FileText }
];

const viewportWorkspaceQuery =
  "(min-width: 1280px) and (min-height: 640px)";

function subscribeToViewportWorkspace(callback: () => void) {
  const mediaQuery = window.matchMedia(viewportWorkspaceQuery);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function isViewportWorkspace() {
  return window.matchMedia(viewportWorkspaceQuery).matches;
}

function isServerViewportWorkspace() {
  return false;
}

export function SymbolWorkspaceTabs({
  symbol,
  latest,
  metadata,
  categories,
  categoryId,
  componentAlternatives,
  manufacturer,
  model,
  networkDraft,
  validationIssues,
  readOnly,
  onMetadataChange,
  onCategoryChange,
  onCategoriesUpdated,
  onManufacturerChange,
  onModelChange,
  onNetworkDraftChange
}: {
  symbol: SymbolDetail;
  latest: SymbolVersionSummary;
  metadata: SymbolMetadata;
  categories: SymbolCategoryRecord[];
  categoryId: string;
  componentAlternatives: ComponentAlternativeCandidate[];
  manufacturer: string;
  model: string;
  networkDraft: NetworkProfileReviewDraft;
  validationIssues: ValidationIssue[];
  readOnly: boolean;
  onMetadataChange: (
    updater: (current: SymbolMetadata) => SymbolMetadata
  ) => void;
  onCategoryChange: (categoryId: string) => void;
  onCategoriesUpdated: (update: SymbolCategoryManagerUpdate) => void;
  onManufacturerChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onNetworkDraftChange: (draft: NetworkProfileReviewDraft) => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const tabs = [
    baseTabs[0],
    { key: "bom" as const, label: "BOM", icon: PackageSearch },
    ...baseTabs.slice(1)
  ];
  const isNetworkSymbol = symbol.technicalKind === "network_device";
  const viewportWorkspace = useSyncExternalStore(
    subscribeToViewportWorkspace,
    isViewportWorkspace,
    isServerViewportWorkspace
  );

  return (
    <div className={`flex min-h-0 flex-col gap-5 ${styles.tabWorkspace}`}>
      <div
        className={`flex flex-wrap gap-2 border-b border-slate-200 ${styles.tabList}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={[
                "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
                isActive
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              ].join(" ")}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon aria-hidden="true" size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <div
          className={[
            `grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 ${styles.overview}`,
            isNetworkSymbol
              ? "xl:grid-cols-[minmax(360px,0.7fr)_minmax(620px,1.3fr)]"
              : "xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]"
          ].join(" ")}
        >
          <div
            className={styles.previewColumn}
            data-testid="symbol-preview-column"
          >
            <SvgPreviewPanel
              svg={latest.svg}
              title={`Version ${latest.versionNumber}`}
              metadata={metadata}
              fitMode={viewportWorkspace ? "container" : "width"}
              componentAlternativeNames={Object.fromEntries(
                componentAlternatives.map((alternative) => [
                  alternative.symbolId,
                  alternative.displayName
                ])
              )}
            />
          </div>
          <div
            className={`min-w-0 space-y-5 ${styles.detailsPane} ${styles.scrollRegion}`}
            data-testid="symbol-details-scroll-region"
            role="region"
            aria-label="Symbol details"
            tabIndex={0}
          >
            <SymbolRegistryDetailsPanel
              metadata={metadata}
              categories={categories}
              categoryId={categoryId}
              readOnly={readOnly}
              onChange={onMetadataChange}
              onCategoryChange={onCategoryChange}
              onCategoriesUpdated={onCategoriesUpdated}
            />
            {isNetworkSymbol ? (
              <NetworkProfilePanel
                manufacturer={manufacturer}
                model={model}
                draft={networkDraft}
                anchors={metadata.anchors}
                readOnly={readOnly}
                onManufacturerChange={onManufacturerChange}
                onModelChange={onModelChange}
                onDraftChange={onNetworkDraftChange}
              />
            ) : (
              <>
                <SymbolLayoutMetadataPanel
                  metadata={metadata}
                  technicalKind={symbol.technicalKind}
                  readOnly={readOnly}
                  onChange={onMetadataChange}
                />
                <SymbolPanelWiringCapabilityPanel
                  metadata={metadata}
                  readOnly={readOnly}
                  onChange={onMetadataChange}
                />
                <SymbolComponentsPanel
                  positions={metadata.componentPositions ?? []}
                  alternatives={componentAlternatives.filter(
                    (alternative) => alternative.symbolId !== symbol.id
                  )}
                  readOnly={readOnly}
                  onChange={(positions) =>
                    onMetadataChange((current) => ({
                      ...current,
                      componentPositions:
                        positions.length > 0 ? positions : undefined
                    }))
                  }
                />
                <TerminalMapTable
                  versionId={latest.id}
                  metadata={metadata}
                  readOnly={readOnly}
                  onChange={(terminals) =>
                    onMetadataChange((current) => ({
                      ...current,
                      terminals
                    }))
                  }
                />
                <SymbolElectricalTopologyPanel
                  metadata={metadata}
                  readOnly={readOnly}
                  onChange={onMetadataChange}
                />
              </>
            )}
            <ValidationPanel issues={validationIssues} />
          </div>
        </div>
      ) : null}

      {activeTab === "engineer_notes" ? (
        <div
          className={`${styles.tabScrollRegion} ${styles.scrollRegion}`}
          role="region"
          aria-label="Scrollable tab content"
          tabIndex={0}
        >
          <EngineerNotesPanel
            symbolId={symbol.id}
            versionId={latest.id}
            notes={symbol.engineerNotes}
          />
        </div>
      ) : null}

      {activeTab === "documents" ? (
        <div
          className={`${styles.tabScrollRegion} ${styles.scrollRegion}`}
          role="region"
          aria-label="Scrollable tab content"
          tabIndex={0}
        >
          <SymbolDocumentsPanel
            symbolId={symbol.id}
            versionId={latest.id}
            documents={symbol.documents}
          />
        </div>
      ) : null}

      {activeTab === "bom" ? (
        <div
          className={`${styles.tabScrollRegion} ${styles.scrollRegion}`}
          role="region"
          aria-label="Scrollable tab content"
          tabIndex={0}
        >
          <SymbolBomPanelLoader symbolId={symbol.id} />
        </div>
      ) : null}
    </div>
  );
}
