"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import {
  CheckCircle2,
  FileDown,
  Link2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Save,
  StickyNote
} from "lucide-react";
import {
  approveNetworkMapAction,
  loadApprovedNetworkSymbolForPlacementAction,
  saveNetworkMapAction
} from "../../api/actions";
import {
  createDefaultNetworkMapSheet,
  type NetworkMapAnnotation,
  type NetworkMapModel,
  type NetworkMapSheet,
  type NetworkMapTitleBlock,
  type NetworkNodeEditableUpdates
} from "../../data/schema";
import type {
  ActionResult,
  ApprovedNetworkSymbol,
  ApprovedNetworkSymbolCatalogItem,
  NetworkLibraryFilters,
  NetworkMapDetail,
  NetworkMapSelection,
  NetworkPlacementToolState
} from "../../types";
import { DEFAULT_NETWORK_LIBRARY_FILTERS } from "../../logic/services/network-library-catalog";
import {
  addNetworkNodeCommand,
  allocateNetworkNodeTag,
  deleteNetworkNodeCommand,
  moveNetworkNodesCommand,
  updateNetworkNodeCommand
} from "../../logic/commands/network-node-commands";
import type {
  NetworkNodeSize,
  NetworkPoint
} from "../../logic/services/network-node-geometry";
import { networkSymbolReferenceKey } from "../../logic/services/network-link-routing";
import { NetworkMapLibraryPanel } from "./network-map-library-panel";
import { NetworkMapPropertiesPanel } from "./network-map-properties-panel";
import { NetworkMapSurface } from "./network-map-surface";

function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function updateSheet(
  model: NetworkMapModel,
  sheetId: string,
  updater: (sheet: NetworkMapSheet) => NetworkMapSheet
): NetworkMapModel {
  return {
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId ? updater(sheet) : sheet
    )
  };
}

function duplicateSheet(
  sheet: NetworkMapSheet,
  sheetNumber: number,
  model: NetworkMapModel
): NetworkMapSheet {
  const newId = nextId("sheet");
  const zoneIds = new Map(
    sheet.zones.map((zone) => [zone.id, `${zone.id}_${newId}`])
  );
  const zones = sheet.zones.map((zone) => ({
    ...zone,
    id: zoneIds.get(zone.id) ?? zone.id
  }));
  let allocationModel = model;
  const nodes = sheet.nodes.map((node) => {
    const copy = {
      ...node,
      id: `${node.id}_${newId}`,
      tag: allocateNetworkNodeTag(allocationModel, node.deviceType),
      zoneId: node.zoneId ? zoneIds.get(node.zoneId) : undefined
    };

    allocationModel = {
      ...allocationModel,
      sheets: [
        ...allocationModel.sheets,
        { ...sheet, id: `${newId}_allocation`, nodes: [copy], links: [] }
      ]
    };
    return copy;
  });

  return {
    ...sheet,
    id: newId,
    name: `${sheet.name} ${sheetNumber}`,
    zones,
    nodes,
    links: [],
    annotations: sheet.annotations.map((annotation) => ({
      ...annotation,
      id: `${annotation.id}_${newId}`
    }))
  };
}

export function NetworkMapShell({
  networkMap,
  catalogItems,
  referencedSymbols
}: {
  networkMap: NetworkMapDetail;
  catalogItems: ApprovedNetworkSymbolCatalogItem[];
  referencedSymbols: ApprovedNetworkSymbol[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(networkMap.title);
  const [model, setModel] = useState<NetworkMapModel>(networkMap.model);
  const [activeSheetId, setActiveSheetId] = useState(
    networkMap.model.sheets[0]?.id ?? "sheet_1"
  );
  const [selection, setSelection] = useState<NetworkMapSelection>(null);
  const [placementTool, setPlacementTool] =
    useState<NetworkPlacementToolState>({ mode: "idle" });
  const [resolvedSymbols, setResolvedSymbols] =
    useState<ApprovedNetworkSymbol[]>(referencedSymbols);
  const symbolCacheRef = useRef(
    new Map(referencedSymbols.map((symbol) => [symbol.versionId, symbol]))
  );
  const inFlightSymbolsRef = useRef(
    new Map<
      string,
      Promise<ActionResult<ApprovedNetworkSymbol>>
    >()
  );
  const placementRequestRef = useRef<string | null>(null);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
  const [libraryFilters, setLibraryFilters] = useState<NetworkLibraryFilters>(
    DEFAULT_NETWORK_LIBRARY_FILTERS
  );
  const [message, setMessage] = useState<string | null>(null);
  const activeSheet =
    model.sheets.find((sheet) => sheet.id === activeSheetId) ?? model.sheets[0];
  const activeSheetNumber = Math.max(
    1,
    model.sheets.findIndex((sheet) => sheet.id === activeSheet?.id) + 1
  );
  const selectedAnnotation =
    selection?.kind === "annotation"
      ? activeSheet?.annotations.find(
          (annotation) => annotation.id === selection.id
        )
      : undefined;
  const selectedNode =
    selection?.kind === "node"
      ? activeSheet?.nodes.find((node) => node.id === selection.id)
      : undefined;
  const symbolsByReference = useMemo(
    () =>
      new Map(
        resolvedSymbols.map((symbol) => [
          networkSymbolReferenceKey(symbol.symbolId, symbol.versionId),
          symbol
        ])
      ),
    [resolvedSymbols]
  );
  const selectedNodeSymbol = selectedNode
    ? symbolsByReference.get(
        networkSymbolReferenceKey(selectedNode.symbolId, selectedNode.versionId)
      )
    : undefined;
  const nodeCount = model.sheets.reduce(
    (total, sheet) => total + sheet.nodes.length,
    0
  );
  const linkCount = model.sheets.reduce(
    (total, sheet) => total + sheet.links.length,
    0
  );
  const zoneCount = model.sheets.reduce(
    (total, sheet) => total + sheet.zones.length,
    0
  );
  const statusText = networkMap.status.replace("_", " ");
  const titleBlock = model.titleBlock;

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => setMessage(null), 5000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    const additions = referencedSymbols.filter(
      (symbol) => !symbolCacheRef.current.has(symbol.versionId)
    );

    if (additions.length === 0) {
      return;
    }

    additions.forEach((symbol) =>
      symbolCacheRef.current.set(symbol.versionId, symbol)
    );
    setResolvedSymbols((current) => [...current, ...additions]);
  }, [referencedSymbols]);

  const cancelPlacement = useCallback(() => {
    placementRequestRef.current = null;
    setPlacementTool({ mode: "idle" });
  }, []);

  const togglePlacement = useCallback(
    (item: ApprovedNetworkSymbolCatalogItem) => {
      if (
        placementTool.mode !== "idle" &&
        placementTool.item.versionId === item.versionId
      ) {
        cancelPlacement();
        setMessage("Placement cancelled.");
        return;
      }

      const cachedSymbol = symbolCacheRef.current.get(item.versionId);

      if (cachedSymbol) {
        placementRequestRef.current = null;
        setPlacementTool({ mode: "placing", item, symbol: cachedSymbol });
        setMessage(`Click the active sheet to place ${item.displayName}.`);
        return;
      }

      const requestId = `${item.versionId}:${crypto.randomUUID()}`;
      placementRequestRef.current = requestId;
      setPlacementTool({ mode: "loading", item });

      let request = inFlightSymbolsRef.current.get(item.versionId);

      if (!request) {
        request = loadApprovedNetworkSymbolForPlacementAction(item.versionId);
        inFlightSymbolsRef.current.set(item.versionId, request);
      }

      void (async () => {
        try {
          const result = await request;

          if (placementRequestRef.current !== requestId) {
            return;
          }

          if (!result.ok) {
            setPlacementTool({ mode: "idle" });
            setMessage(result.error);
            return;
          }

          symbolCacheRef.current.set(result.data.versionId, result.data);
          setResolvedSymbols((current) =>
            current.some((symbol) => symbol.versionId === result.data.versionId)
              ? current
              : [...current, result.data]
          );
          setPlacementTool({ mode: "placing", item, symbol: result.data });
          setMessage(`Click the active sheet to place ${item.displayName}.`);
        } catch (error) {
          if (placementRequestRef.current === requestId) {
            setPlacementTool({ mode: "idle" });
            setMessage(
              error instanceof Error
                ? error.message
                : "The network symbol could not be loaded."
            );
          }
        } finally {
          if (inFlightSymbolsRef.current.get(item.versionId) === request) {
            inFlightSymbolsRef.current.delete(item.versionId);
          }
        }
      })();
    },
    [cancelPlacement, placementTool]
  );

  const placeNode = useCallback(
    (point: NetworkPoint) => {
      if (!activeSheet || placementTool.mode !== "placing") {
        return;
      }

      try {
        const result = addNetworkNodeCommand(model, {
          sheetId: activeSheet.id,
          nodeId: `node_${crypto.randomUUID()}`,
          source: {
            symbolId: placementTool.symbol.symbolId,
            versionId: placementTool.symbol.versionId,
            deviceType: placementTool.item.deviceType,
            viewBox: placementTool.symbol.metadata.viewBox
          },
          point
        });

        setModel(result.model);
        setSelection({ kind: "node", id: result.node.id });
        setPlacementTool({ mode: "idle" });
        setMessage(`${result.node.tag} placed.`);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "The device could not be placed."
        );
      }
    },
    [activeSheet, model, placementTool]
  );

  const updateSelectedNode = useCallback(
    (updates: NetworkNodeEditableUpdates): boolean => {
      if (!activeSheet || !selectedNode) {
        return false;
      }

      try {
        setModel(
          updateNetworkNodeCommand(model, {
            sheetId: activeSheet.id,
            nodeId: selectedNode.id,
            updates
          })
        );
        setMessage("Device properties updated.");
        return true;
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "The device properties could not be updated."
        );
        return false;
      }
    },
    [activeSheet, model, selectedNode]
  );

  const moveNode = useCallback(
    (nodeId: string, delta: NetworkPoint, size: NetworkNodeSize) => {
      if (!activeSheet) {
        return;
      }

      try {
        setModel(
          moveNetworkNodesCommand(model, {
            sheetId: activeSheet.id,
            nodeIds: [nodeId],
            delta,
            nodeSizes: { [nodeId]: size }
          })
        );
        setMessage("Device moved.");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "The device could not be moved."
        );
      }
    },
    [activeSheet, model]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!activeSheet) {
        return;
      }

      const removedLinks = activeSheet.links.filter(
        (link) => link.from.nodeId === nodeId || link.to.nodeId === nodeId
      ).length;

      try {
        setModel(
          deleteNetworkNodeCommand(model, {
            sheetId: activeSheet.id,
            nodeId
          })
        );
        setSelection(null);
        setMessage(
          removedLinks > 0
            ? `Device deleted with ${removedLinks} connected link${
                removedLinks === 1 ? "" : "s"
              }.`
            : "Device deleted."
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "The device could not be deleted."
        );
      }
    },
    [activeSheet, model]
  );

  const save = useCallback(() => {
    startTransition(async () => {
      const result = await saveNetworkMapAction({
        networkMapId: networkMap.id,
        title,
        model
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage("Network map saved.");
      router.refresh();
    });
  }, [model, networkMap.id, router, title]);

  const approve = useCallback(() => {
    startTransition(async () => {
      const saveResult = await saveNetworkMapAction({
        networkMapId: networkMap.id,
        title,
        model
      });

      if (!saveResult.ok) {
        setMessage(saveResult.error);
        return;
      }

      const result = await approveNetworkMapAction(networkMap.id);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage("Network map approved.");
      router.refresh();
    });
  }, [model, networkMap.id, router, title]);

  const exportPdf = useCallback(() => {
    window.location.assign(
      new URL(`/networking/${networkMap.id}/pdf`, window.location.origin).toString()
    );
  }, [networkMap.id]);

  const addSheet = useCallback(() => {
    const sheet = createDefaultNetworkMapSheet({
      id: nextId("sheet"),
      name: `Sheet ${model.sheets.length + 1}`
    });

    setModel((current) => ({
      ...current,
      sheets: [...current.sheets, sheet]
    }));
    setActiveSheetId(sheet.id);
    setSelection(null);
    setMessage("Sheet added.");
  }, [model.sheets.length]);

  const addNote = useCallback(() => {
    const targetSheet = activeSheet;

    if (!targetSheet) {
      return;
    }

    const annotation: NetworkMapAnnotation = {
      id: nextId("note"),
      title: "Note",
      text: "New network note",
      x: 24,
      y: 42,
      width: 94,
      height: 24,
      kind: "note"
    };

    setModel((current) =>
      updateSheet(current, targetSheet.id, (sheet) => ({
        ...sheet,
        annotations: [...sheet.annotations, annotation]
      }))
    );
    setSelection({ kind: "annotation", id: annotation.id });
    setMessage("Note added.");
  }, [activeSheet]);

  const updateTitleBlock = useCallback(
    (updates: Partial<NetworkMapTitleBlock>) => {
      setModel((current) => ({
        ...current,
        titleBlock: {
          ...current.titleBlock,
          ...updates
        }
      }));
    },
    []
  );

  const updateSheetMetadata = useCallback(
    (
      sheetId: string,
      updates: Pick<Partial<NetworkMapSheet>, "name" | "description">
    ) => {
      setModel((current) =>
        updateSheet(current, sheetId, (sheet) => ({
          ...sheet,
          ...updates
        }))
      );
    },
    []
  );

  const updateAnnotation = useCallback(
    (annotationId: string, updates: Partial<NetworkMapAnnotation>) => {
      if (!activeSheet) {
        return;
      }

      setModel((current) =>
        updateSheet(current, activeSheet.id, (sheet) => ({
          ...sheet,
          annotations: sheet.annotations.map((annotation) =>
            annotation.id === annotationId
              ? { ...annotation, ...updates }
              : annotation
          )
        }))
      );
    },
    [activeSheet]
  );

  const removeAnnotation = useCallback(
    (annotationId: string) => {
      if (!activeSheet) {
        return;
      }

      setModel((current) =>
        updateSheet(current, activeSheet.id, (sheet) => ({
          ...sheet,
          annotations: sheet.annotations.filter(
            (annotation) => annotation.id !== annotationId
          )
        }))
      );
      setSelection(null);
      setMessage("Note deleted.");
    },
    [activeSheet]
  );

  const moveSheet = useCallback((sheetId: string, direction: -1 | 1) => {
    setModel((current) => {
      const currentIndex = current.sheets.findIndex((sheet) => sheet.id === sheetId);
      const nextIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= current.sheets.length
      ) {
        return current;
      }

      const sheets = [...current.sheets];
      const [sheet] = sheets.splice(currentIndex, 1);

      if (!sheet) {
        return current;
      }

      sheets.splice(nextIndex, 0, sheet);
      return { ...current, sheets };
    });
  }, []);

  const moveSheetToEnd = useCallback((sheetId: string) => {
    setModel((current) => {
      const currentIndex = current.sheets.findIndex((sheet) => sheet.id === sheetId);

      if (currentIndex < 0 || currentIndex === current.sheets.length - 1) {
        return current;
      }

      const sheets = [...current.sheets];
      const [sheet] = sheets.splice(currentIndex, 1);

      if (!sheet) {
        return current;
      }

      sheets.push(sheet);
      return { ...current, sheets };
    });
  }, []);

  const duplicateActiveSheet = useCallback((sheetId: string) => {
    setModel((current) => {
      const sourceIndex = current.sheets.findIndex((sheet) => sheet.id === sheetId);
      const sourceSheet = current.sheets[sourceIndex];

      if (!sourceSheet) {
        return current;
      }

      const copy = duplicateSheet(
        sourceSheet,
        current.sheets.length + 1,
        current
      );
      const sheets = [...current.sheets];
      sheets.splice(sourceIndex + 1, 0, copy);
      setActiveSheetId(copy.id);
      setSelection(null);
      return { ...current, sheets };
    });
    setMessage("Sheet duplicated.");
  }, []);

  const deleteSheet = useCallback((sheetId: string) => {
    setModel((current) => {
      if (current.sheets.length <= 1) {
        return current;
      }

      const sheetIndex = current.sheets.findIndex((sheet) => sheet.id === sheetId);
      const sheets = current.sheets.filter((sheet) => sheet.id !== sheetId);
      const nextActiveSheet = sheets[Math.max(0, sheetIndex - 1)] ?? sheets[0];

      if (nextActiveSheet) {
        setActiveSheetId(nextActiveSheet.id);
      }

      setSelection(null);
      return { ...current, sheets };
    });
    setMessage("Sheet deleted.");
  }, []);

  const showDeferredMessage = useCallback((label: string) => {
    setMessage(`${label} will use the shared canvas tooling in the next editor pass.`);
  }, []);

  const summary = useMemo(
    () => [
      { label: "Sheets", value: model.sheets.length },
      { label: "Nodes", value: nodeCount },
      { label: "Links", value: linkCount },
      { label: "Zones", value: zoneCount }
    ],
    [linkCount, model.sheets.length, nodeCount, zoneCount]
  );

  return (
    <div className="space-y-5">
      <div className="tool-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {networkMap.mapKey} / {statusText}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="icon-button"
            disabled={isPending}
            onClick={() => showDeferredMessage("Network assets")}
          >
            <Network aria-hidden="true" size={14} />
            Network Assets
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={isPending}
            onClick={save}
          >
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
          <button
            type="button"
            className="icon-button"
            disabled={isPending}
            onClick={addNote}
          >
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
            className="icon-button"
            disabled={isPending}
            onClick={() => showDeferredMessage("Connect mode")}
          >
            <Link2 aria-hidden="true" size={14} />
            Connect
          </button>
        </div>
      </div>

      <div
        className={[
          "drawing-canvas-layout",
          isLibraryCollapsed ? "drawing-canvas-layout-symbols-collapsed" : "",
          isPropertiesCollapsed
            ? "drawing-canvas-layout-properties-collapsed"
            : ""
        ].join(" ")}
      >
        <aside
          className={[
            "drawing-symbols-sidebar",
            isLibraryCollapsed
              ? "drawing-symbols-sidebar-collapsed"
              : "drawing-symbols-sidebar-expanded"
          ].join(" ")}
          aria-label="Network library"
        >
          {isLibraryCollapsed ? (
            <div
              className="tool-panel drawing-sidebar-rail"
              data-testid="network-library-rail"
            >
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setIsLibraryCollapsed(false)}
                aria-label="Expand network library panel"
                title="Expand network library panel"
              >
                <PanelLeftOpen aria-hidden="true" size={17} />
              </button>
            </div>
          ) : (
            <NetworkMapLibraryPanel
              catalogItems={catalogItems}
              filters={libraryFilters}
              placementTool={placementTool}
              onFiltersChange={setLibraryFilters}
              onPlacementToggle={togglePlacement}
              headerAction={
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={() => setIsLibraryCollapsed(true)}
                  aria-label="Collapse network library panel"
                  title="Collapse network library panel"
                >
                  <PanelLeftClose aria-hidden="true" size={17} />
                </button>
              }
            />
          )}
        </aside>

        <NetworkMapSurface
          model={model}
          title={title}
          activeSheetId={activeSheet?.id ?? activeSheetId}
          selection={selection}
          placementTool={placementTool}
          referencedSymbols={resolvedSymbols}
          statusMessage={message}
          onActiveSheetChange={(sheetId) => {
            setActiveSheetId(sheetId);
            setSelection(null);
          }}
          onAddSheet={addSheet}
          onAddNote={addNote}
          onDuplicateSheet={duplicateActiveSheet}
          onMoveSheet={moveSheet}
          onMoveSheetToEnd={moveSheetToEnd}
          onDeleteSheet={deleteSheet}
          onSelectionChange={setSelection}
          onNodePlace={placeNode}
          onNodeMove={moveNode}
          onNodeDelete={deleteNode}
          onPlacementCancel={cancelPlacement}
        />

        <aside
          className={[
            "drawing-properties-sidebar",
            isPropertiesCollapsed
              ? "drawing-properties-sidebar-collapsed"
              : "drawing-properties-sidebar-expanded"
          ].join(" ")}
          aria-label="Network properties"
        >
          {isPropertiesCollapsed ? (
            <div
              className="tool-panel drawing-sidebar-rail"
              data-testid="network-properties-rail"
            >
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setIsPropertiesCollapsed(false)}
                aria-label="Expand network properties panel"
                title="Expand network properties panel"
              >
                <PanelRightOpen aria-hidden="true" size={17} />
              </button>
            </div>
          ) : activeSheet ? (
            <div className="space-y-5">
              <NetworkMapPropertiesPanel
                title={title}
                model={{
                  ...model,
                  titleBlock
                }}
                activeSheet={activeSheet}
                activeSheetNumber={activeSheetNumber}
                sheetCount={model.sheets.length}
                selectedNode={selectedNode}
                selectedNodeSymbol={selectedNodeSymbol}
                selectedAnnotation={selectedAnnotation}
                headerAction={
                  <button
                    type="button"
                    className="sidebar-toggle"
                    onClick={() => setIsPropertiesCollapsed(true)}
                    aria-label="Collapse network properties panel"
                    title="Collapse network properties panel"
                  >
                    <PanelRightClose aria-hidden="true" size={17} />
                  </button>
                }
                onTitleChange={setTitle}
                onTitleBlockChange={updateTitleBlock}
                onSheetMetadataChange={updateSheetMetadata}
                onNodeChange={updateSelectedNode}
                onNodeDelete={() => selectedNode && deleteNode(selectedNode.id)}
                onAnnotationChange={updateAnnotation}
                onAnnotationRemove={removeAnnotation}
              />
              <section className="tool-panel overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-bold">Map Summary</h2>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 text-xs font-semibold text-slate-600">
                  {summary.map((item) => (
                    <div
                      key={item.label}
                      className="rounded border border-slate-200 bg-white px-3 py-2"
                    >
                      <p className="text-[11px] uppercase text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
