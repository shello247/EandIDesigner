"use client";

import { useState } from "react";
import { FileText, LayoutDashboard, NotebookPen } from "lucide-react";
import type {
  SymbolCategory,
  SymbolStatus,
  ValidationIssue
} from "../../data/schema";
import type {
  SymbolDocumentSummary,
  SymbolEngineerNoteSummary,
  SymbolVersionSummary
} from "../../types";
import { EngineerNotesPanel } from "./engineer-notes-panel";
import { NetworkProfilePanel } from "./network-profile-panel";
import { SvgPreviewPanel } from "./svg-preview-panel";
import { SymbolDocumentsPanel } from "./symbol-documents-panel";
import { SymbolLayoutMetadataPanel } from "./symbol-layout-metadata-panel";
import { TerminalMapTable } from "./terminal-map-table";
import { ValidationPanel } from "./validation-panel";

type WorkspaceTab = "overview" | "engineer_notes" | "documents";

const tabs: Array<{
  key: WorkspaceTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "engineer_notes", label: "Engineer Notes", icon: NotebookPen },
  { key: "documents", label: "Documents", icon: FileText }
];

export function SymbolWorkspaceTabs({
  symbolId,
  category,
  symbolStatus,
  manufacturer,
  model,
  latest,
  validationIssues,
  engineerNotes,
  documents
}: {
  symbolId: string;
  category: SymbolCategory;
  symbolStatus: SymbolStatus;
  manufacturer?: string | null;
  model?: string | null;
  latest: SymbolVersionSummary;
  validationIssues: ValidationIssue[];
  engineerNotes: SymbolEngineerNoteSummary[];
  documents: SymbolDocumentSummary[];
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const editable =
    symbolStatus !== "archived" &&
    (latest.status === "draft" || latest.status === "needs_review");
  const isNetworkSymbol = category === "network_device";

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
                manufacturer={manufacturer}
                model={model}
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
                <TerminalMapTable
                  versionId={latest.id}
                  metadata={latest.metadata}
                  readOnly={!editable}
                />
              </>
            )}
            <ValidationPanel issues={validationIssues} />
          </div>
        </div>
      ) : null}

      {activeTab === "engineer_notes" ? (
        <EngineerNotesPanel
          symbolId={symbolId}
          versionId={latest.id}
          notes={engineerNotes}
        />
      ) : null}

      {activeTab === "documents" ? (
        <SymbolDocumentsPanel
          symbolId={symbolId}
          versionId={latest.id}
          documents={documents}
        />
      ) : null}
    </div>
  );
}
