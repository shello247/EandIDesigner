"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileDown, Link2, Save, StickyNote } from "lucide-react";
import type {
  DrawingAnnotation,
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
import {
  addConnection as addConnectionCommand,
  addAnnotation as addAnnotationCommand,
  addPlacement as addPlacementCommand,
  deleteAnnotation as deleteAnnotationCommand,
  deleteConnection as deleteConnectionCommand,
  deletePlacement as deletePlacementCommand,
  updateAnnotation as updateAnnotationCommand,
  updateConnection as updateConnectionCommand,
  updateConnectionRoute as updateConnectionRouteCommand,
  updatePlacementProperties
} from "../../logic/commands/drawing-model-commands";
import { generateDefaultOrthogonalRoute } from "../../logic/services/connection-route-geometry";
import { createDefaultNoteAnnotation } from "../../logic/services/drawing-annotations";
import { createConnectionFromEndpoints } from "../../logic/services/drawing-connections";
import type { ViewportTransform } from "../../logic/services/viewport-transform";
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
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | undefined>(
    drawing.model.placements[0]?.id
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | undefined
  >(undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
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
  const [viewportCenter, setViewportCenter] = useState({
    x: drawing.model.sheet.width / 2,
    y: drawing.model.sheet.height / 2
  });
  const [message, setMessage] = useState<string | null>(null);

  const selectPlacement = (placementId: string | undefined) => {
    setSelectedPlacementId(placementId);

    if (placementId) {
      setSelectedConnectionId(undefined);
      setSelectedAnnotationId(undefined);
    }
  };

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

    setModel((current) => addPlacementCommand(current, placement));
    selectPlacement(placement.id);
    setSelectedConnectionId(undefined);
  };

  const updatePlacement = (
    placementId: string,
    updates: Partial<DrawingPlacement>
  ) => {
    setModel((current) =>
      updatePlacementProperties(current, placementId, updates)
    );
  };

  const updateTitleBlock = (
    updates: Partial<DrawingModel["sheet"]["titleBlock"]>
  ) => {
    setModel((current) => ({
      ...current,
      sheet: {
        ...current.sheet,
        titleBlock: {
          ...current.sheet.titleBlock,
          ...updates
        }
      }
    }));
  };

  const removePlacement = (placementId: string) => {
    setModel((current) => deletePlacementCommand(current, placementId));
    setSelectedPlacementId(undefined);
    setSelectedConnectionId(undefined);
    setSelectedAnnotationId(undefined);
    setConnectionDraft({});
  };

  const addNote = () => {
    const annotation = createDefaultNoteAnnotation({
      id: `note_${Date.now()}`,
      point: {
        x: viewportCenter.x - 35,
        y: viewportCenter.y - 12
      },
      sheet: model.sheet
    });

    setModel((current) => addAnnotationCommand(current, annotation));
    setSelectedAnnotationId(annotation.id);
    setSelectedPlacementId(undefined);
    setSelectedConnectionId(undefined);
    setConnectionDraft({});
    setMessage("Note added.");
  };

  const updateAnnotation = (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => {
    setModel((current) =>
      updateAnnotationCommand(current, annotationId, updates)
    );
  };

  const removeAnnotation = (annotationId: string) => {
    setModel((current) => deleteAnnotationCommand(current, annotationId));
    setSelectedAnnotationId((current) =>
      current === annotationId ? undefined : current
    );
  };

  const updateConnection = (
    connectionId: string,
    updates: Partial<DrawingConnection>
  ) => {
    setModel((current) =>
      updateConnectionCommand(current, connectionId, updates)
    );
  };

  const updateConnectionRoute = (
    connectionId: string,
    route: DrawingConnectionRoute
  ) => {
    setModel((current) =>
      updateConnectionRouteCommand(current, connectionId, route)
    );
  };

  const resetConnectionRoute = (connectionId: string) => {
    setModel((current) => {
      const connection = current.connections.find(
        (candidate) => candidate.id === connectionId
      );

      if (!connection) {
        return current;
      }

      const route = generateDefaultOrthogonalRoute({
        model: current,
        symbols,
        connection,
        mode: "auto"
      });

      return route
        ? updateConnectionRouteCommand(current, connectionId, route)
        : current;
    });
  };

  const removeConnection = (connectionId: string) => {
    setModel((current) => deleteConnectionCommand(current, connectionId));
    setSelectedConnectionId((current) =>
      current === connectionId ? undefined : current
    );
  };

  const selectConnection = (connectionId: string | undefined) => {
    setSelectedConnectionId(connectionId);

    if (connectionId) {
      setSelectedPlacementId(undefined);
      setSelectedAnnotationId(undefined);
    }
  };

  const selectAnnotation = (annotationId: string | undefined) => {
    setSelectedAnnotationId(annotationId);

    if (annotationId) {
      setSelectedPlacementId(undefined);
      setSelectedConnectionId(undefined);
      setConnectionDraft({});
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

    setModel((current) => addConnectionCommand(current, routedConnection));
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

      setMessage("Drawing approved.");
      router.refresh();
    });
  };

  const exportPdf = () => {
    window.location.assign(
      new URL(`/drawings/${drawing.id}/pdf`, window.location.origin).toString()
    );
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
            className="icon-button"
            disabled={isPending}
            onClick={exportPdf}
          >
            <FileDown aria-hidden="true" size={14} />
            Preview PDF
          </button>
          <button type="button" className="icon-button" disabled={isPending} onClick={addNote}>
            <StickyNote aria-hidden="true" size={14} />
            Add note
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={isPending}
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
        <div
          className="fixed right-6 top-24 z-50 flex max-w-sm items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg shadow-emerald-950/10"
          role="status"
          data-testid="drawing-toast"
        >
          <CheckCircle2 aria-hidden="true" size={16} className="shrink-0" />
          <span>{message}</span>
        </div>
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
          onSelectPlacement={selectPlacement}
          onPlacementChange={updatePlacement}
          onPlacementRemove={removePlacement}
          selectedAnnotationId={selectedAnnotationId}
          onAnnotationSelect={selectAnnotation}
          onAnnotationChange={updateAnnotation}
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
          onViewportCenterChange={setViewportCenter}
        />
        <div className="space-y-5">
          <PlacementPropertiesPanel
            title={title}
            model={model}
            symbols={symbols}
            onTitleChange={setTitle}
            onTitleBlockChange={updateTitleBlock}
            selectedConnectionId={selectedConnectionId}
            selectedAnnotationId={selectedAnnotationId}
            onConnectionSelect={selectConnection}
            onConnectionChange={updateConnection}
            onConnectionRemove={removeConnection}
            onConnectionRouteReset={resetConnectionRoute}
            onAnnotationChange={updateAnnotation}
            onAnnotationRemove={removeAnnotation}
          />
        </div>
      </div>
    </div>
  );
}
