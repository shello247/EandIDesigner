"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Link2, Save } from "lucide-react";
import type {
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingEndpoint,
  DrawingModel,
  DrawingPlacement,
  DrawingPlacementRole
} from "../../data/schema";
import type { ApprovedDrawingSymbol, DrawingDetail } from "../../types";
import {
  approveDrawingAction,
  saveDrawingAction
} from "../../api/actions";
import { generateDefaultOrthogonalRoute } from "../../logic/services/connection-route-geometry";
import { createConnectionFromEndpoints } from "../../logic/services/drawing-connections";
import type { ViewportTransform } from "../../logic/services/viewport-transform";
import { DrawingValidationPanel } from "./drawing-validation-panel";
import { PlacementPropertiesPanel } from "./placement-properties-panel";
import { SvgDrawingSurface } from "./svg-drawing-surface";
import { SymbolLibraryPanel } from "./symbol-library-panel";

type DragState = {
  placementId: string;
  startPointer: { x: number; y: number };
  startPlacement: { x: number; y: number };
};

type ConnectionMode = "idle" | "connecting";

type ConnectionDraft = {
  from?: DrawingEndpoint;
  pointer?: { x: number; y: number };
};

function roleFromCategory(category: ApprovedDrawingSymbol["category"]): DrawingPlacementRole {
  if (category === "cable_assembly") {
    return "cable_assembly";
  }

  if (category === "terminal_block") {
    return "terminal_block";
  }

  if (category === "instrument" || category === "monitor") {
    return "device";
  }

  return "other";
}

function defaultScale(symbol: ApprovedDrawingSymbol): number {
  if (symbol.category === "cable_assembly") {
    return 0.5;
  }

  if (symbol.category === "monitor") {
    return 0.36;
  }

  return 0.34;
}

function uniqueTag(base: string, placements: DrawingPlacement[]): string {
  const normalized = base.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  const fallback = normalized || "SYM";
  const existing = new Set(placements.map((placement) => placement.tag));

  if (!existing.has(fallback)) {
    return fallback;
  }

  for (let index = 2; index < placements.length + 20; index += 1) {
    const candidate = `${fallback}_${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return `${fallback}_${Date.now()}`;
}

function tagPrefixForSymbol(symbol: ApprovedDrawingSymbol): string {
  if (symbol.category === "cable_assembly") {
    return "C";
  }

  if (symbol.category === "terminal_block") {
    return "TB";
  }

  if (symbol.category === "monitor") {
    return "TSM";
  }

  if (symbol.category === "instrument") {
    const descriptor = `${symbol.symbolKey} ${symbol.model ?? ""} ${symbol.displayName}`.toUpperCase();

    if (descriptor.includes("NMT") || descriptor.includes("TEMP")) {
      return "TT";
    }

    if (descriptor.includes("FMP") || descriptor.includes("RADAR") || descriptor.includes("LEVEL")) {
      return "LIT";
    }

    return "INST";
  }

  return "EQ";
}

function nextEngineeringTag(
  symbol: ApprovedDrawingSymbol,
  placements: DrawingPlacement[]
): string {
  const prefix = tagPrefixForSymbol(symbol);
  const existing = new Set(placements.map((placement) => placement.tag));

  for (let index = 101; index < 1000; index += 1) {
    const candidate = `${prefix}-${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return uniqueTag(`${prefix}-1000`, placements);
}

export function DrawingCanvasShell({
  drawing,
  symbols
}: {
  drawing: DrawingDetail;
  symbols: ApprovedDrawingSymbol[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(drawing.title);
  const [model, setModel] = useState<DrawingModel>(drawing.model);
  const [issues, setIssues] = useState(drawing.validationIssues);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | undefined>(
    drawing.model.placements[0]?.id
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | undefined
  >(undefined);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("idle");
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({});
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [viewportTransform, setViewportTransform] = useState<ViewportTransform>({
    zoom: 1,
    panX: 0,
    panY: 0
  });
  const [message, setMessage] = useState<string | null>(null);
  const blockingIssueCount = useMemo(
    () => issues.filter((issue) => issue.severity === "blocking").length,
    [issues]
  );

  const addSymbol = (symbol: ApprovedDrawingSymbol) => {
    const tag = nextEngineeringTag(symbol, model.placements);
    const placement: DrawingPlacement = {
      id: `pl_${Date.now()}`,
      symbolId: symbol.symbolId,
      versionId: symbol.versionId,
      role: roleFromCategory(symbol.category),
      tag,
      x: 35 + model.placements.length * 18,
      y: 45 + model.placements.length * 12,
      rotation: 0,
      scale: defaultScale(symbol)
    };

    setModel((current) => ({
      ...current,
      placements: [...current.placements, placement]
    }));
    setSelectedPlacementId(placement.id);
    setSelectedConnectionId(undefined);
  };

  const updatePlacement = (
    placementId: string,
    updates: Partial<DrawingPlacement>
  ) => {
    setModel((current) => ({
      ...current,
      placements: current.placements.map((placement) =>
        placement.id === placementId ? { ...placement, ...updates } : placement
      )
    }));
  };

  const removePlacement = (placementId: string) => {
    setModel((current) => ({
      ...current,
      placements: current.placements.filter(
        (placement) => placement.id !== placementId
      ),
      connections: current.connections.filter(
        (connection) =>
          connection.from.placementId !== placementId &&
          connection.to.placementId !== placementId &&
          connection.cablePlacementId !== placementId
      )
    }));
    setSelectedPlacementId(undefined);
    setSelectedConnectionId(undefined);
    setConnectionDraft({});
  };

  const updateConnection = (
    connectionId: string,
    updates: Partial<DrawingConnection>
  ) => {
    setModel((current) => ({
      ...current,
      connections: current.connections.map((connection) =>
        connection.id === connectionId ? { ...connection, ...updates } : connection
      )
    }));
  };

  const updateConnectionRoute = (
    connectionId: string,
    route: DrawingConnectionRoute
  ) => {
    updateConnection(connectionId, { route });
  };

  const resetConnectionRoute = (connectionId: string) => {
    setModel((current) => ({
      ...current,
      connections: current.connections.map((connection) => {
        if (connection.id !== connectionId) {
          return connection;
        }

        const route = generateDefaultOrthogonalRoute({
          model: current,
          symbols,
          connection,
          mode: "auto"
        });

        return route ? { ...connection, route } : connection;
      })
    }));
  };

  const removeConnection = (connectionId: string) => {
    setModel((current) => ({
      ...current,
      connections: current.connections.filter(
        (connection) => connection.id !== connectionId
      )
    }));
    setSelectedConnectionId((current) =>
      current === connectionId ? undefined : current
    );
  };

  const selectConnection = (connectionId: string | undefined) => {
    setSelectedConnectionId(connectionId);

    if (connectionId) {
      setSelectedPlacementId(undefined);
    }
  };

  const toggleConnectMode = () => {
    setConnectionMode((current) => (current === "connecting" ? "idle" : "connecting"));
    setConnectionDraft({});
    setSelectedConnectionId(undefined);
    setMessage(null);
  };

  const cancelConnectionAuthoring = () => {
    if (connectionDraft.from) {
      setConnectionDraft({});
      setMessage("Connection start cleared.");
      return;
    }

    setConnectionMode("idle");
    setSelectedConnectionId(undefined);
    setMessage(null);
  };

  const handleConnectionAnchorClick = (endpoint: DrawingEndpoint) => {
    if (connectionMode !== "connecting") {
      return;
    }

    if (!connectionDraft.from) {
      setConnectionDraft({ from: endpoint });
      setSelectedPlacementId(endpoint.placementId);
      setSelectedConnectionId(undefined);
      setMessage("Select a destination anchor.");
      return;
    }

    const result = createConnectionFromEndpoints({
      model,
      symbols,
      from: connectionDraft.from,
      to: endpoint
    });

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    const route = generateDefaultOrthogonalRoute({
      model,
      symbols,
      connection: result.connection,
      mode: "auto"
    });
    const routedConnection = route
      ? { ...result.connection, route }
      : result.connection;

    setModel((current) => ({
      ...current,
      connections: [...current.connections, routedConnection]
    }));
    setSelectedConnectionId(routedConnection.id);
    setSelectedPlacementId(undefined);
    setConnectionDraft({});
    setMessage("Connection added.");
  };

  const handleConnectionPointerMove = (pointer: { x: number; y: number }) => {
    setConnectionDraft((current) =>
      current.from ? { ...current, pointer } : current
    );
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveDrawingAction({
        drawingId: drawing.id,
        title,
        model
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setIssues(result.data.validationIssues);
      setMessage("Drawing saved.");
      router.refresh();
    });
  };

  const approve = () => {
    startTransition(async () => {
      const saveResult = await saveDrawingAction({
        drawingId: drawing.id,
        title,
        model
      });

      if (!saveResult.ok) {
        setMessage(saveResult.error);
        return;
      }

      const result = await approveDrawingAction(drawing.id);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setIssues(result.data.validationIssues);
      setMessage("Drawing approved.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="tool-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {drawing.drawingKey} / {drawing.status.replace("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="icon-button" disabled={isPending} onClick={save}>
            <Save aria-hidden="true" size={14} />
            Save
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={isPending || blockingIssueCount > 0}
            onClick={approve}
          >
            <CheckCircle2 aria-hidden="true" size={14} />
            Approve
          </button>
          <button
            type="button"
            className={[
              "icon-button",
              connectionMode === "connecting" ? "icon-button-primary" : ""
            ].join(" ")}
            aria-pressed={connectionMode === "connecting"}
            disabled={isPending}
            onClick={toggleConnectMode}
          >
            <Link2 aria-hidden="true" size={14} />
            Connect
          </button>
        </div>
      </div>

      {message ? (
        <div className="tool-panel p-3 text-sm text-slate-700">{message}</div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <SymbolLibraryPanel symbols={symbols} onAddSymbol={addSymbol} />
        <SvgDrawingSurface
          model={model}
          symbols={symbols}
          selectedPlacementId={selectedPlacementId}
          viewportTransform={viewportTransform}
          setViewportTransform={setViewportTransform}
          dragState={dragState}
          onSelectPlacement={setSelectedPlacementId}
          onPlacementChange={updatePlacement}
          onPlacementRemove={removePlacement}
          onDragStart={setDragState}
          onDragMove={(placementId, x, y) => updatePlacement(placementId, { x, y })}
          onDragEnd={() => setDragState(null)}
          connectionMode={connectionMode}
          connectionDraft={connectionDraft}
          selectedConnectionId={selectedConnectionId}
          onConnectionAnchorClick={handleConnectionAnchorClick}
          onConnectionPointerMove={handleConnectionPointerMove}
          onConnectionSelect={selectConnection}
          onConnectionRouteChange={updateConnectionRoute}
          onConnectionCancel={cancelConnectionAuthoring}
        />
        <div className="space-y-5">
          <PlacementPropertiesPanel
            title={title}
            model={model}
            symbols={symbols}
            onTitleChange={setTitle}
            selectedConnectionId={selectedConnectionId}
            onConnectionSelect={selectConnection}
            onConnectionChange={updateConnection}
            onConnectionRemove={removeConnection}
            onConnectionRouteReset={resetConnectionRoute}
          />
          <DrawingValidationPanel issues={issues} />
        </div>
      </div>
    </div>
  );
}
