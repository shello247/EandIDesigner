"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { FileText, LayoutDashboard, NotebookPen, PackageSearch } from "lucide-react";
import type { SymbolDetail, SymbolVersionSummary } from "../../types";
import { EngineerNotesPanel } from "./engineer-notes-panel";
import { NetworkProfilePanel } from "./network-profile-panel";
import { SvgPreviewPanel } from "./svg-preview-panel";
import { SymbolDocumentsPanel } from "./symbol-documents-panel";
import { SymbolLayoutMetadataPanel } from "./symbol-layout-metadata-panel";
import { SymbolPanelWiringCapabilityPanel } from "./symbol-panel-wiring-capability-panel";
import { TerminalMapTable } from "./terminal-map-table";
import { ValidationPanel } from "./validation-panel";
import type { ComponentAlternativeCandidate } from "@/features/symbol_components/api/public";
import { SymbolComponentsPanel } from "@/features/symbol_components/ui/components/symbol-components-panel";

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

export function SymbolWorkspaceTabs({
  symbol,
  latest,
  componentAlternatives,
  bomPanel
}: {
  symbol: SymbolDetail;
  latest: SymbolVersionSummary;
  componentAlternatives: ComponentAlternativeCandidate[];
  bomPanel?: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const tabs = bomPanel
    ? [
        baseTabs[0],
        { key: "bom" as const, label: "BOM", icon: PackageSearch },
        ...baseTabs.slice(1)
      ]
    : baseTabs;
  const editable =
    symbol.status !== "archived" &&
    (latest.status === "draft" || latest.status === "needs_review");
  const isNetworkSymbol = symbol.category === "network_device";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-slate-200" role="tablist">
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
            "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5",
            isNetworkSymbol
              ? "xl:grid-cols-[minmax(360px,0.7fr)_minmax(620px,1.3fr)]"
              : "xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]"
          ].join(" ")}
        >
          <SvgPreviewPanel
            svg={latest.svg}
            title={`Version ${latest.versionNumber}`}
            metadata={latest.metadata}
          />
          <div className="min-w-0 space-y-5">
            {isNetworkSymbol ? (
              <NetworkProfilePanel
                versionId={latest.id}
                manufacturer={symbol.manufacturer}
                model={symbol.model}
                profile={latest.metadata.networkProfile}
                anchors={latest.metadata.anchors}
                editable={editable}
              />
            ) : (
              <>
                <SymbolLayoutMetadataPanel
                  versionId={latest.id}
                  metadata={latest.metadata}
                  readOnly={!editable}
                />
                <SymbolPanelWiringCapabilityPanel
                  versionId={latest.id}
                  metadata={latest.metadata}
                />
                <SymbolComponentsPanel
                  versionId={latest.id}
                  positions={latest.metadata.componentPositions ?? []}
                  alternatives={componentAlternatives.filter(
                    (alternative) => alternative.symbolId !== symbol.id
                  )}
                  readOnly={!editable}
                />
                <TerminalMapTable
                  versionId={latest.id}
                  metadata={latest.metadata}
                  readOnly={!editable}
                />
              </>
            )}
            <ValidationPanel issues={symbol.validationIssues} />
          </div>
        </div>
      ) : null}

      {activeTab === "engineer_notes" ? (
        <EngineerNotesPanel
          symbolId={symbol.id}
          versionId={latest.id}
          notes={symbol.engineerNotes}
        />
      ) : null}

      {activeTab === "documents" ? (
        <SymbolDocumentsPanel
          symbolId={symbol.id}
          versionId={latest.id}
          documents={symbol.documents}
        />
      ) : null}

      {activeTab === "bom" ? bomPanel : null}
    </div>
  );
}
