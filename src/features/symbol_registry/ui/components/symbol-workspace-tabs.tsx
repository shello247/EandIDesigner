"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { LayoutDashboard, PackageSearch } from "lucide-react";
import type { SymbolDetail, SymbolVersionSummary } from "../../types";
import type { SymbolMetadata } from "../../data/schema";
import type { NetworkProfileReviewDraft } from "../../logic/services/network-profile-review-draft";
import { NetworkProfilePanel } from "./network-profile-panel";
import { SvgPreviewPanel } from "./svg-preview-panel";
import { SymbolLayoutMetadataPanel } from "./symbol-layout-metadata-panel";
import { SymbolPanelWiringCapabilityPanel } from "./symbol-panel-wiring-capability-panel";
import { SymbolElectricalTopologyPanel } from "./symbol-electrical-topology-panel";
import { SymbolRegistryDetailsPanel } from "./symbol-registry-details-panel";
import { TerminalMapTable } from "./terminal-map-table";
import type { ComponentAlternativeCandidate } from "@/features/symbol_components/api/public";
import { SymbolComponentsPanel } from "@/features/symbol_components/ui/components/symbol-components-panel";
import { SymbolBomPanelLoader } from "@/features/bom_creator/ui/components/symbol-bom-panel-loader";
import dynamic from "next/dynamic";
const SymbolProductConfiguration = dynamic(() => import("@/features/item_engineering/ui/components/symbol-product-configuration").then(m=>m.SymbolProductConfiguration));
import styles from "./symbol-detail-workspace.module.css";

type WorkspaceTab = "overview" | "bom" | "products";

const tabs: Array<{
  key: WorkspaceTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "bom", label: "BOM", icon: PackageSearch },
  { key: "products", label: "Compatible Items", icon: PackageSearch }
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
  actions,
  artworkAction,
  symbol,
  latest,
  metadata,
  componentAlternatives,
  manufacturer,
  model,
  networkDraft,
  readOnly,
  classificationBlocked,
  onMetadataChange,
  onManufacturerChange,
  onModelChange,
  onNetworkDraftChange
}: {
  actions: ReactNode;
  artworkAction?: ReactNode;
  symbol: SymbolDetail;
  latest: SymbolVersionSummary;
  metadata: SymbolMetadata;
  componentAlternatives: ComponentAlternativeCandidate[];
  manufacturer: string;
  model: string;
  networkDraft: NetworkProfileReviewDraft;
  readOnly: boolean;
  classificationBlocked: boolean;
  onMetadataChange: (
    updater: (current: SymbolMetadata) => SymbolMetadata
  ) => void;
  onManufacturerChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onNetworkDraftChange: (draft: NetworkProfileReviewDraft) => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [productsVisited,setProductsVisited] = useState(false);
  const isNetworkSymbol = symbol.technicalKind === "network_device";
  const viewportWorkspace = useSyncExternalStore(
    subscribeToViewportWorkspace,
    isViewportWorkspace,
    isServerViewportWorkspace
  );

  return (
    <div className={`flex min-h-0 flex-col gap-3 ${styles.tabWorkspace}`}>
      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 ${styles.tabList}`}
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Symbol workspace">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`symbol-${symbol.id}-tab-${tab.key}`}
                aria-controls={`symbol-${symbol.id}-panel-${tab.key}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={[
                  "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
                  isActive
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                ].join(" ")}
                onClick={() => {setActiveTab(tab.key);if(tab.key==="products")setProductsVisited(true);}}
                onKeyDown={(event) => {
                  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
                    : event.key === "ArrowRight" ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : undefined;
                  if (next === undefined) return;
                  event.preventDefault();
                  setActiveTab(tabs[next].key);
                  if(tabs[next].key==="products")setProductsVisited(true);
                  document.getElementById(`symbol-${symbol.id}-tab-${tabs[next].key}`)?.focus();
                }}
              >
                <Icon aria-hidden="true" size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto max-w-full pb-1">{actions}</div>
      </div>

      {activeTab === "overview" ? (
        <div
          role="tabpanel"
          id={`symbol-${symbol.id}-panel-overview`}
          aria-labelledby={`symbol-${symbol.id}-tab-overview`}
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
            {artworkAction ? <div className="mb-2 flex justify-end">{artworkAction}</div> : null}
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
              versionId={latest.id}
              deviceType={latest.deviceType}
              classificationBlocked={classificationBlocked}
              readOnly={readOnly}
              onChange={onMetadataChange}
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
                  deviceType={latest.deviceType}
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
          </div>
        </div>
      ) : null}

      {productsVisited && <div hidden={activeTab!=="products"} className={`${styles.tabScrollRegion} ${styles.scrollRegion}`} role="tabpanel" id={`symbol-${symbol.id}-panel-products`} aria-labelledby={`symbol-${symbol.id}-tab-products`}>
        <SymbolProductConfiguration symbolVersionId={latest.id} readOnly={readOnly}/>
      </div>}
      {activeTab === "bom" ? (
        <div
          className={`${styles.tabScrollRegion} ${styles.scrollRegion}`}
          role="tabpanel"
          id={`symbol-${symbol.id}-panel-bom`}
          aria-labelledby={`symbol-${symbol.id}-tab-bom`}
          tabIndex={0}
        >
          <SymbolBomPanelLoader symbolId={symbol.id} />
        </div>
      ) : null}
    </div>
  );
}
