"use client";

import { memo, useMemo, useState } from "react";
import type {
  NetworkMapModel,
  NetworkMapNode,
  NetworkMapSheet,
  NetworkMapTitleBlock
} from "../../data/schema";
import type {
  ApprovedNetworkSymbol,
  NetworkMapSelection,
  NetworkPlacementToolState
} from "../../types";
import type {
  NetworkNodeSize,
  NetworkPoint
} from "../../logic/services/network-node-geometry";
import { networkSymbolReferenceKey } from "../../logic/services/network-link-routing";
import { renderNetworkMapSheetToSvg } from "../../logic/services/network-svg-renderer";
import { NetworkNodeOverlay } from "../canvas/network-node-overlay";

const SHEET_PIXEL_SCALE = 2;

export const NetworkMapSheetFrame = memo(function NetworkMapSheetFrame({
  sheet,
  titleBlock,
  mapTitle,
  sheetNumber,
  sheetCount,
  approvedSymbols,
  isActive,
  zoom,
  selection,
  placementTool,
  onActivate,
  onPlace,
  onSelectionChange,
  onNodeMove,
  onNodeDelete,
  onPlacementCancel
}: {
  sheet: NetworkMapSheet;
  titleBlock: NetworkMapTitleBlock;
  mapTitle: string;
  sheetNumber: number;
  sheetCount: number;
  approvedSymbols: ApprovedNetworkSymbol[];
  isActive: boolean;
  zoom: number;
  selection: NetworkMapSelection;
  placementTool: NetworkPlacementToolState;
  onActivate: (sheetId: string) => void;
  onPlace: (point: NetworkPoint) => void;
  onSelectionChange: (selection: NetworkMapSelection) => void;
  onNodeMove: (
    nodeId: string,
    delta: NetworkPoint,
    size: NetworkNodeSize
  ) => void;
  onNodeDelete: (nodeId: string) => void;
  onPlacementCancel: () => void;
}) {
  const [preview, setPreview] = useState<{
    nodeId: string;
    position: Pick<NetworkMapNode, "x" | "y">;
  } | null>(null);
  const renderedSheet = useMemo(
    () =>
      preview
        ? {
            ...sheet,
            nodes: sheet.nodes.map((node) =>
              node.id === preview.nodeId
                ? { ...node, ...preview.position }
                : node
            )
          }
        : sheet,
    [preview, sheet]
  );
  const renderModel = useMemo<NetworkMapModel>(
    () => ({ version: 1, titleBlock, sheets: [renderedSheet] }),
    [renderedSheet, titleBlock]
  );
  const symbolsByReference = useMemo(
    () =>
      new Map(
        approvedSymbols.map((symbol) => [
          networkSymbolReferenceKey(symbol.symbolId, symbol.versionId),
          symbol
        ])
      ),
    [approvedSymbols]
  );
  const svg = useMemo(
    () =>
      renderNetworkMapSheetToSvg({
        model: renderModel,
        sheet: renderedSheet,
        approvedSymbols,
        mapTitle,
        sheetNumber,
        sheetCount
      }),
    [approvedSymbols, mapTitle, renderModel, renderedSheet, sheetCount, sheetNumber]
  );
  const stageWidth = sheet.page.width * SHEET_PIXEL_SCALE;
  const stageHeight = sheet.page.height * SHEET_PIXEL_SCALE;
  const scaledWidth = Number((stageWidth * zoom).toFixed(3));
  const scaledHeight = Number((stageHeight * zoom).toFixed(3));

  return (
    <div
      className={[
        "drawing-sheet-frame",
        isActive ? "drawing-sheet-frame-active" : "",
        "network-map-sheet-frame"
      ].join(" ")}
      data-testid="network-map-sheet-frame"
      data-network-sheet-id={sheet.id}
      data-active-sheet={isActive ? "true" : "false"}
      role={isActive ? undefined : "button"}
      tabIndex={isActive ? undefined : 0}
      aria-label={
        isActive ? undefined : `Activate sheet ${sheetNumber}: ${sheet.name}`
      }
      onPointerDown={(event) => {
        if (isActive || event.button !== 0) {
          return;
        }
        event.preventDefault();
        onActivate(sheet.id);
      }}
      onKeyDown={(event) => {
        if (isActive || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }
        event.preventDefault();
        onActivate(sheet.id);
      }}
    >
      <div className="drawing-sheet-caption">
        <span className="drawing-sheet-caption-index">
          Sheet {sheetNumber} of {sheetCount}
        </span>
        <span className="drawing-sheet-caption-name">{sheet.name}</span>
      </div>
      <div
        className="network-map-sheet-scale-frame"
        style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
      >
        <div
          className="drawing-sheet-stage network-map-sheet-stage"
          data-testid={isActive ? "network-map-sheet-stage" : "network-map-sheet-preview"}
          style={{
            width: `${stageWidth}px`,
            height: `${stageHeight}px`,
            transform: `scale(${zoom})`
          }}
        >
          <div
            className="drawing-sheet-paper"
            data-sheet-paper="true"
            data-testid="network-map-paper"
          >
            <div
              className="drawing-sheet-rendered"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            {isActive ? (
              <NetworkNodeOverlay
                sheet={renderedSheet}
                symbolsByReference={symbolsByReference}
                selection={selection}
                placementTool={placementTool}
                viewportZoom={zoom}
                onPlace={onPlace}
                onSelectionChange={onSelectionChange}
                onNodePreview={(nodeId, position) =>
                  setPreview(position ? { nodeId, position } : null)
                }
                onNodeMove={onNodeMove}
                onNodeDelete={onNodeDelete}
                onPlacementCancel={onPlacementCancel}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});
