"use client";

import type { ReactNode, Ref } from "react";
import {
  Cable,
  FilePenLine,
  Link2,
  List,
  ListTree,
  Network
} from "lucide-react";
import { DrawingViewportToolbar } from "./drawing-viewport-toolbar";
import { DrawingGuidesToggle } from "./drawing-guides-toggle";

export function DrawingSheetToolbar({
  insertionControl,
  preview = false,
  previewToolbarRef,
  zoom,
  disabled,
  readOnly,
  showConnectAction,
  connectLabel,
  connectActive,
  showPatternAction,
  patternActive,
  guidesVisible,
  onOpenSheetLoader,
  onEditActiveSheet,
  isTitleSheet = false,
  onOpenConnections,
  onToggleConnect,
  onTogglePattern,
  onToggleGuidesVisible,
  onFit,
  onActualSize,
  onZoomIn,
  onZoomOut
}: {
  insertionControl: ReactNode;
  preview?: boolean;
  previewToolbarRef: Ref<HTMLDivElement>;
  zoom: number;
  disabled: boolean;
  readOnly: boolean;
  showConnectAction: boolean;
  connectLabel: "Connect" | "Wire";
  connectActive: boolean;
  showPatternAction: boolean;
  patternActive: boolean;
  guidesVisible: boolean;
  onOpenSheetLoader: () => void;
  onEditActiveSheet: () => void;
  isTitleSheet?: boolean;
  onOpenConnections: () => void;
  onToggleConnect: () => void;
  onTogglePattern: () => void;
  onToggleGuidesVisible: () => void;
  onFit: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="drawing-sheet-toolbar" data-testid="drawing-sheet-toolbar">
      <div className="drawing-sheet-toolbar-primary">
        <div className="drawing-sheet-toolbar-group" aria-label="Sheet controls">
          {!preview ? insertionControl : null}
          <button
            type="button"
            className="icon-button h-9"
            disabled={disabled}
            aria-label="Open sheet loader"
            title="Open sheet loader"
            onClick={onOpenSheetLoader}
          >
            <List aria-hidden="true" size={18} />
            Sheets
          </button>
          {!preview ? <><button
            type="button"
            className={isTitleSheet ? "icon-button icon-button-primary h-9" : "icon-button drawing-toolbar-icon-action h-9 w-9 p-0"}
            disabled={disabled || readOnly}
            aria-label={isTitleSheet ? "Edit Title Sheet" : "Edit active sheet"}
            data-tooltip={isTitleSheet ? undefined : "Edit Sheet"}
            onClick={onEditActiveSheet}
          >
            <FilePenLine aria-hidden="true" size={18} />
            {isTitleSheet ? "Edit Title Sheet" : null}
          </button>
          <button
            type="button"
            className="icon-button drawing-toolbar-icon-action h-9 w-9 p-0"
            disabled={disabled}
            aria-label="Browse connections"
            data-tooltip="Connections"
            onClick={onOpenConnections}
          >
            <ListTree aria-hidden="true" size={18} />
          </button></> : null}
        </div>
        {!preview ? <div className="drawing-sheet-toolbar-group" aria-label="Canvas authoring controls">
          <DrawingGuidesToggle
            disabled={disabled || readOnly}
            visible={guidesVisible}
            onToggle={onToggleGuidesVisible}
          />
          {showConnectAction ? (
            <button
              type="button"
              className={[
                "icon-button drawing-toolbar-icon-action h-9 w-9 p-0",
                connectActive ? "icon-button-primary" : ""
              ].join(" ")}
              aria-label={connectLabel}
              aria-pressed={connectActive}
              data-tooltip={connectLabel}
              disabled={disabled || readOnly}
              onClick={onToggleConnect}
            >
              {connectLabel === "Wire" ? (
                <Cable aria-hidden="true" size={18} />
              ) : (
                <Link2 aria-hidden="true" size={18} />
              )}
            </button>
          ) : null}
          {showPatternAction ? (
            <button
              type="button"
              className={[
                "icon-button h-9",
                patternActive ? "icon-button-primary" : ""
              ].join(" ")}
              aria-pressed={patternActive}
              disabled={disabled || readOnly}
              onClick={onTogglePattern}
            >
              <Network aria-hidden="true" size={18} />
              Pattern
            </button>
          ) : null}
        </div> : null}
      </div>
      <div className="drawing-sheet-toolbar-viewport" ref={preview ? previewToolbarRef : undefined}>
        {!preview ? <DrawingViewportToolbar
          zoom={zoom}
          onFit={onFit}
          onActualSize={onActualSize}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
        /> : null}
      </div>
    </div>
  );
}
