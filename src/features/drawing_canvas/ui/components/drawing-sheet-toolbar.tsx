"use client";

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
  onOpenConnections,
  onToggleConnect,
  onTogglePattern,
  onToggleGuidesVisible,
  onFit,
  onActualSize,
  onZoomIn,
  onZoomOut
}: {
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
    <div className="drawing-sheet-toolbar">
      <div className="drawing-sheet-toolbar-primary">
        <div className="drawing-sheet-toolbar-group" aria-label="Sheet controls">
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
          <button
            type="button"
            className="icon-button drawing-toolbar-icon-action h-9 w-9 p-0"
            disabled={disabled || readOnly}
            aria-label="Edit active sheet"
            data-tooltip="Edit Sheet"
            onClick={onEditActiveSheet}
          >
            <FilePenLine aria-hidden="true" size={18} />
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
          </button>
        </div>
        <div className="drawing-sheet-toolbar-group" aria-label="Canvas authoring controls">
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
        </div>
      </div>
      <div className="drawing-sheet-toolbar-viewport">
        <DrawingViewportToolbar
          zoom={zoom}
          onFit={onFit}
          onActualSize={onActualSize}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
        />
      </div>
    </div>
  );
}
