"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
  saveNetworkMapAction
} from "../../api/actions";
import {
  createDefaultNetworkMapSheet,
  type NetworkMapAnnotation,
  type NetworkMapModel,
  type NetworkMapSheet,
  type NetworkMapTitleBlock
} from "../../data/schema";
import type { ApprovedNetworkSymbol, NetworkMapDetail } from "../../types";
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

function duplicateSheet(sheet: NetworkMapSheet, sheetNumber: number): NetworkMapSheet {
  const newId = nextId("sheet");

  return {
    ...sheet,
    id: newId,
    name: `${sheet.name} ${sheetNumber}`,
    zones: sheet.zones.map((zone) => ({
      ...zone,
      id: `${zone.id}_${newId}`
    })),
    nodes: sheet.nodes.map((node) => ({
      ...node,
      id: `${node.id}_${newId}`
    })),
    links: [],
    annotations: sheet.annotations.map((annotation) => ({
      ...annotation,
      id: `${annotation.id}_${newId}`
    }))
  };
}

export function NetworkMapShell({
  networkMap,
  symbols
}: {
  networkMap: NetworkMapDetail;
  symbols: ApprovedNetworkSymbol[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(networkMap.title);
  const [model, setModel] = useState<NetworkMapModel>(networkMap.model);
  const [activeSheetId, setActiveSheetId] = useState(
    networkMap.model.sheets[0]?.id ?? "sheet_1"
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | undefined
  >(undefined);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeSheet =
    model.sheets.find((sheet) => sheet.id === activeSheetId) ?? model.sheets[0];
  const activeSheetNumber = Math.max(
    1,
    model.sheets.findIndex((sheet) => sheet.id === activeSheet?.id) + 1
  );
  const selectedAnnotation = activeSheet?.annotations.find(
    (annotation) => annotation.id === selectedAnnotationId
  );
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
    setSelectedAnnotationId(undefined);
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
    setSelectedAnnotationId(annotation.id);
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
      setSelectedAnnotationId(undefined);
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

      const copy = duplicateSheet(sourceSheet, current.sheets.length + 1);
      const sheets = [...current.sheets];
      sheets.splice(sourceIndex + 1, 0, copy);
      setActiveSheetId(copy.id);
      setSelectedAnnotationId(undefined);
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

      setSelectedAnnotationId(undefined);
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
          selectedAnnotationId={selectedAnnotationId}
          symbols={symbols}
          statusMessage={message}
          onActiveSheetChange={(sheetId) => {
            setActiveSheetId(sheetId);
            setSelectedAnnotationId(undefined);
          }}
          onAddSheet={addSheet}
          onAddNote={addNote}
          onDuplicateSheet={duplicateActiveSheet}
          onMoveSheet={moveSheet}
          onMoveSheetToEnd={moveSheetToEnd}
          onDeleteSheet={deleteSheet}
          onAnnotationSelect={setSelectedAnnotationId}
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
