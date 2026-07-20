"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type {
  NetworkMapAnnotation,
  NetworkMapModel,
  NetworkMapNode,
  NetworkMapSheet,
  NetworkMapTitleBlock,
  NetworkNodeEditableUpdates
} from "../../data/schema";
import type { ApprovedNetworkSymbol } from "../../types";
import { NetworkNodePropertiesPanel } from "./network-node-properties-panel";

function optionalValue(value: string | undefined): string {
  return value ?? "";
}

export function NetworkMapPropertiesPanel({
  title,
  model,
  activeSheet,
  activeSheetNumber,
  sheetCount,
  selectedNode,
  selectedNodeSymbol,
  selectedAnnotation,
  headerAction,
  onTitleChange,
  onTitleBlockChange,
  onSheetMetadataChange,
  onNodeChange,
  onNodeDelete,
  onAnnotationChange,
  onAnnotationRemove
}: {
  title: string;
  model: NetworkMapModel;
  activeSheet: NetworkMapSheet;
  activeSheetNumber: number;
  sheetCount: number;
  selectedNode?: NetworkMapNode;
  selectedNodeSymbol?: ApprovedNetworkSymbol;
  selectedAnnotation?: NetworkMapAnnotation;
  headerAction?: ReactNode;
  onTitleChange: (title: string) => void;
  onTitleBlockChange: (updates: Partial<NetworkMapTitleBlock>) => void;
  onSheetMetadataChange: (
    sheetId: string,
    updates: Pick<Partial<NetworkMapSheet>, "name" | "description">
  ) => void;
  onNodeChange: (updates: NetworkNodeEditableUpdates) => boolean;
  onNodeDelete: () => void;
  onAnnotationChange: (
    annotationId: string,
    updates: Partial<NetworkMapAnnotation>
  ) => void;
  onAnnotationRemove: (annotationId: string) => void;
}) {
  const [isTitleBlockExpanded, setIsTitleBlockExpanded] = useState(false);
  const titleBlock = model.titleBlock;

  return (
    <div className="space-y-5">
      <section className="tool-panel overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Network Properties</h2>
          {headerAction ?? null}
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="field-label" htmlFor="network-map-title">
              Title
            </label>
            <input
              id="network-map-title"
              className="field-input"
              value={title}
              onChange={(event) => onTitleChange(event.currentTarget.value)}
            />
          </div>
        </div>
      </section>

      {selectedNode ? (
        <NetworkNodePropertiesPanel
          node={selectedNode}
          symbol={selectedNodeSymbol}
          zones={activeSheet.zones}
          onNodeChange={onNodeChange}
          onNodeDelete={onNodeDelete}
        />
      ) : null}

      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Sheet Properties</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Sheet {activeSheetNumber} of {sheetCount}
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="field-label" htmlFor="network-sheet-name">
              Sheet name
            </label>
            <input
              id="network-sheet-name"
              className="field-input"
              value={activeSheet.name}
              onChange={(event) =>
                onSheetMetadataChange(activeSheet.id, {
                  name: event.currentTarget.value
                })
              }
            />
          </div>
          <div>
            <label className="field-label" htmlFor="network-sheet-description">
              Description
            </label>
            <textarea
              id="network-sheet-description"
              className="field-input min-h-20 resize-y"
              value={activeSheet.description ?? ""}
              placeholder="Optional sheet description"
              onChange={(event) =>
                onSheetMetadataChange(activeSheet.id, {
                  description: event.currentTarget.value
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="tool-panel overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={isTitleBlockExpanded}
          onClick={() => setIsTitleBlockExpanded((current) => !current)}
        >
          <span>
            <span className="block text-sm font-bold">Title Block</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Bottom-right sheet information
            </span>
          </span>
          {isTitleBlockExpanded ? (
            <ChevronDown aria-hidden="true" size={16} />
          ) : (
            <ChevronRight aria-hidden="true" size={16} />
          )}
        </button>
        {isTitleBlockExpanded ? (
          <div className="grid gap-4 border-t border-slate-200 p-4">
            <div>
              <label className="field-label" htmlFor="network-client">
                Client
              </label>
              <input
                id="network-client"
                className="field-input"
                value={optionalValue(titleBlock.client)}
                onChange={(event) =>
                  onTitleBlockChange({ client: event.currentTarget.value })
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-project">
                Project / process
              </label>
              <input
                id="network-project"
                className="field-input"
                value={optionalValue(titleBlock.project)}
                onChange={(event) =>
                  onTitleBlockChange({ project: event.currentTarget.value })
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-map-number">
                Map number
              </label>
              <input
                id="network-map-number"
                className="field-input"
                value={optionalValue(titleBlock.mapNumber)}
                onChange={(event) =>
                  onTitleBlockChange({ mapNumber: event.currentTarget.value })
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-revision">
                Revision
              </label>
              <input
                id="network-revision"
                className="field-input"
                value={optionalValue(titleBlock.revision)}
                onChange={(event) =>
                  onTitleBlockChange({ revision: event.currentTarget.value })
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-prepared-by">
                Prepared by
              </label>
              <input
                id="network-prepared-by"
                className="field-input"
                value={optionalValue(titleBlock.preparedBy)}
                onChange={(event) =>
                  onTitleBlockChange({ preparedBy: event.currentTarget.value })
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-checked-by">
                Checked by
              </label>
              <input
                id="network-checked-by"
                className="field-input"
                value={optionalValue(titleBlock.checkedBy)}
                onChange={(event) =>
                  onTitleBlockChange({ checkedBy: event.currentTarget.value })
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-date">
                Date
              </label>
              <input
                id="network-date"
                className="field-input"
                value={optionalValue(titleBlock.date)}
                onChange={(event) =>
                  onTitleBlockChange({ date: event.currentTarget.value })
                }
              />
            </div>
          </div>
        ) : null}
      </section>

      {selectedAnnotation ? (
        <section className="tool-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-bold">Selected Note</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {selectedAnnotation.title?.trim() || selectedAnnotation.kind}
            </p>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <label className="field-label" htmlFor="network-note-title">
                Note title
              </label>
              <input
                id="network-note-title"
                className="field-input"
                value={selectedAnnotation.title ?? ""}
                placeholder="Optional note title"
                onChange={(event) =>
                  onAnnotationChange(selectedAnnotation.id, {
                    title: event.currentTarget.value
                  })
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-note-text">
                Note text
              </label>
              <textarea
                id="network-note-text"
                className="field-input min-h-24 resize-y"
                value={selectedAnnotation.text}
                onChange={(event) =>
                  onAnnotationChange(selectedAnnotation.id, {
                    text: event.currentTarget.value
                  })
                }
              />
            </div>
            <button
              type="button"
              className="icon-button icon-button-danger"
              onClick={() => onAnnotationRemove(selectedAnnotation.id)}
            >
              <Trash2 aria-hidden="true" size={14} />
              Delete note
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
