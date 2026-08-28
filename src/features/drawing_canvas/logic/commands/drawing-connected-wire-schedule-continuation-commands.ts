import {
  buildPackageConnectivityGraph,
  type PanelConnectionDisplayMode
} from "@/features/drawing_panel_wiring/api/public";
import {
  buildConnectedWireScheduleProjection,
  evaluateConnectedWireScheduleCapacity,
  isConnectedWireScheduleAnnotation,
  type ConnectedWireScheduleAnnotation
} from "@/features/drawing_connected_wire_schedule/api/public";
import {
  drawingPackageModelSchema,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { createPanelWiringSource } from "../../api/panel-wiring-contracts";
import { createDetailedPanelDrawingSheet } from "./drawing-detailed-panel-sheet-commands";
import { placePanelAssetOccurrence } from "./drawing-panel-occurrence-commands";
import {
  connectionDisplayModeScheduleScope,
  getPlacementConnectionDisplayMode
} from "../services/drawing-placement-connection-display";

const MAX_SHEET_NAME_LENGTH = 120;
const MAX_SHEET_DESCRIPTION_LENGTH = 400;

type ContinuationPage = {
  sheet: DrawingPackageSheet;
  annotation: ConnectedWireScheduleAnnotation;
  placement: DrawingPlacement;
  pageIndex: number;
};

export type SynchronizeConnectedWireScheduleContinuationsResult = {
  model: DrawingModel;
  continuationSetId: string;
  pageCount: number;
  createdSheetIds: string[];
  removedSheetIds: string[];
};

export type RemoveConnectedWireSchedulePaginationResult = {
  model: DrawingModel;
  removedSheetIds: string[];
};

function createRuntimeId(prefix: string): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}_${suffix}`;
}

function continuationSheetName(
  sourceName: string,
  pageIndex: number,
  pageCount: number
): string {
  const suffix = ` — Part ${pageIndex + 1} of ${pageCount}`;
  return `${sourceName.slice(
    0,
    Math.max(1, MAX_SHEET_NAME_LENGTH - suffix.length)
  )}${suffix}`;
}

function continuationSheetDescription(input: {
  sourceDescription?: string;
  pageIndex: number;
  pageCount: number;
}): string {
  const suffix = ` (continuation ${input.pageIndex + 1} of ${input.pageCount})`;
  const base = input.sourceDescription?.trim() || "Connected wire schedule";
  return `${base.slice(
    0,
    Math.max(1, MAX_SHEET_DESCRIPTION_LENGTH - suffix.length)
  )}${suffix}`;
}

function isGeneratedContinuationName(name: string, pageIndex: number): boolean {
  return new RegExp(` — Part ${pageIndex + 1} of \\d+$`).test(name);
}

function isGeneratedContinuationDescription(
  description: string | undefined,
  pageIndex: number
): boolean {
  return Boolean(
    description &&
      new RegExp(
        `\\(continuation ${pageIndex + 1} of \\d+\\)$`,
        "i"
      ).test(description)
  );
}

function clonePresentation(
  placement: DrawingPlacement,
  source: DrawingPlacement,
  displayMode: PanelConnectionDisplayMode
): DrawingPlacement {
  return {
    ...placement,
    x: source.x,
    y: source.y,
    rotation: source.rotation,
    scale: source.scale,
    ...(source.labelPosition
      ? { labelPosition: { ...source.labelPosition } }
      : {}),
    ...(source.deviceTitlePosition
      ? { deviceTitlePosition: { ...source.deviceTitlePosition } }
      : {}),
    ...(source.layoutLabel
      ? { layoutLabel: { ...source.layoutLabel } }
      : {}),
    connectionDisplayMode: displayMode
  };
}

function cloneSchedulePresentation(input: {
  source: ConnectedWireScheduleAnnotation;
  target: ConnectedWireScheduleAnnotation;
  sourcePlacementId: string;
  continuationSetId: string;
  pageIndex: number;
  rowsPerPage: number;
  displayMode: PanelConnectionDisplayMode;
}): ConnectedWireScheduleAnnotation {
  const schedule = {
    ...input.target.schedule,
    assetId: input.source.schedule.assetId,
    sourcePlacementId: input.sourcePlacementId,
    scope: connectionDisplayModeScheduleScope(input.displayMode),
    pagination: {
      version: 1 as const,
      continuationSetId: input.continuationSetId,
      pageIndex: input.pageIndex,
      rowsPerPage: input.rowsPerPage
    }
  };
  if (input.source.schedule.columnRatios) {
    schedule.columnRatios = { ...input.source.schedule.columnRatios };
  } else {
    delete schedule.columnRatios;
  }
  return {
    ...input.target,
    x: input.source.x,
    y: input.source.y,
    width: input.source.width,
    schedule
  };
}

function getSourceContext(input: {
  model: DrawingModel;
  sourceSheetId: string;
  sourceAnnotationId: string;
}): {
  sourceSheet: DrawingPackageSheet;
  sourceAnnotation: ConnectedWireScheduleAnnotation;
  sourcePlacement: DrawingPlacement;
} {
  const sourceSheet = input.model.sheets.find(
    (candidate) => candidate.id === input.sourceSheetId
  );
  if (sourceSheet?.panelDrawingContext?.kind !== "detailed_panel_wiring") {
    throw new Error(
      "Connected Wire Schedule continuations require a Detailed Panel Drawing."
    );
  }
  const sourceAnnotation = sourceSheet.annotations.find(
    (candidate) => candidate.id === input.sourceAnnotationId
  );
  if (!sourceAnnotation || !isConnectedWireScheduleAnnotation(sourceAnnotation)) {
    throw new Error("The source Connected Wire Schedule is unavailable.");
  }
  if (
    sourceAnnotation.schedule.pagination &&
    sourceAnnotation.schedule.pagination.pageIndex !== 0
  ) {
    throw new Error(
      "Create or synchronize continuation sheets from Part 1 of the schedule."
    );
  }
  const sourcePlacement = sourceSheet.placements.find(
    (candidate) => candidate.id === sourceAnnotation.schedule.sourcePlacementId
  );
  if (
    !sourcePlacement?.assetId ||
    sourcePlacement.assetId !== sourceAnnotation.schedule.assetId
  ) {
    throw new Error("The schedule's linked equipment occurrence is unavailable.");
  }
  if (
    sourcePlacement.containerAssetId !==
    sourceSheet.panelDrawingContext.panelAssetId
  ) {
    throw new Error("The linked equipment does not belong to this panel.");
  }
  return { sourceSheet, sourceAnnotation, sourcePlacement };
}

function collectContinuationPages(input: {
  model: DrawingModel;
  continuationSetId: string;
  sourceSheet: DrawingPackageSheet;
  sourceAnnotation: ConnectedWireScheduleAnnotation;
}): Map<number, ContinuationPage> {
  const pages = new Map<number, ContinuationPage>();
  const sourceIndex = input.model.sheets.findIndex(
    (sheet) => sheet.id === input.sourceSheet.id
  );
  const nextSectionIndex = input.model.sheets.findIndex(
    (sheet, index) => index > sourceIndex && sheet.kind === "section_title"
  );
  const sectionEnd = nextSectionIndex < 0 ? input.model.sheets.length : nextSectionIndex;

  for (const [sheetIndex, sheet] of input.model.sheets.entries()) {
    for (const annotation of sheet.annotations) {
      if (
        !isConnectedWireScheduleAnnotation(annotation) ||
        annotation.schedule.pagination?.continuationSetId !==
          input.continuationSetId
      ) {
        continue;
      }
      const pageIndex = annotation.schedule.pagination.pageIndex;
      if (pages.has(pageIndex)) {
        throw new Error(
          `Continuation set ${input.continuationSetId} contains duplicate Part ${pageIndex + 1}.`
        );
      }
      if (pageIndex === 0 && annotation.id !== input.sourceAnnotation.id) {
        throw new Error("The continuation set contains more than one Part 1.");
      }
      if (
        sheetIndex < sourceIndex ||
        sheetIndex >= sectionEnd ||
        sheet.panelDrawingContext?.kind !== "detailed_panel_wiring" ||
        sheet.panelDrawingContext.panelAssetId !==
          input.sourceSheet.panelDrawingContext?.panelAssetId
      ) {
        throw new Error(
          `Part ${pageIndex + 1} is outside the source section or panel context.`
        );
      }
      if (annotation.schedule.assetId !== input.sourceAnnotation.schedule.assetId) {
        throw new Error(
          "A continuation set cannot contain schedules for different assets."
        );
      }
      const placement = sheet.placements.find(
        (candidate) => candidate.id === annotation.schedule.sourcePlacementId
      );
      if (
        !placement?.assetId ||
        placement.assetId !== annotation.schedule.assetId ||
        placement.containerAssetId !== sheet.panelDrawingContext.panelAssetId
      ) {
        throw new Error(
          `Part ${pageIndex + 1} has a stale or mismatched equipment occurrence.`
        );
      }
      pages.set(pageIndex, { sheet, annotation, placement, pageIndex });
    }
  }
  return pages;
}

function isSafeGeneratedContinuationPage(page: ContinuationPage): boolean {
  return (
    page.pageIndex > 0 &&
    page.sheet.placements.length === 1 &&
    page.sheet.placements[0].id === page.placement.id &&
    page.sheet.connections.length === 0 &&
    page.sheet.annotations.length === 1 &&
    page.sheet.annotations[0].id === page.annotation.id &&
    isGeneratedContinuationName(page.sheet.name, page.pageIndex) &&
    isGeneratedContinuationDescription(page.sheet.description, page.pageIndex)
  );
}

function withoutPagination(
  annotation: ConnectedWireScheduleAnnotation,
  displayMode: PanelConnectionDisplayMode
): ConnectedWireScheduleAnnotation {
  const schedule = {
    ...annotation.schedule,
    scope: connectionDisplayModeScheduleScope(displayMode)
  };
  delete schedule.pagination;
  return { ...annotation, schedule };
}

export function createOrSynchronizeConnectedWireScheduleContinuations(input: {
  model: DrawingModel;
  sourceSheetId: string;
  sourceAnnotationId: string;
  rowsPerPage: number;
  symbols?: ApprovedDrawingSymbol[];
  continuationSetId?: string;
  createId?: (prefix: string) => string;
}): SynchronizeConnectedWireScheduleContinuationsResult {
  const symbols = input.symbols ?? [];
  const createId = input.createId ?? createRuntimeId;
  let model = drawingPackageModelSchema.parse(input.model);
  const { sourceSheet, sourceAnnotation, sourcePlacement } = getSourceContext({
    model,
    sourceSheetId: input.sourceSheetId,
    sourceAnnotationId: input.sourceAnnotationId
  });
  const continuationSetId =
    sourceAnnotation.schedule.pagination?.continuationSetId ??
    input.continuationSetId ??
    createId("wire_schedule_set");
  const displayMode = getPlacementConnectionDisplayMode(
    sourcePlacement,
    sourceSheet
  );
  const projection = buildConnectedWireScheduleProjection({
    graph: buildPackageConnectivityGraph(createPanelWiringSource(model, symbols)),
    sheetId: sourceSheet.id,
    annotation: withoutPagination(sourceAnnotation, displayMode),
    displayMode
  });
  const capacity = evaluateConnectedWireScheduleCapacity({
    annotation: sourceAnnotation,
    projection,
    sheet: sourceSheet.page,
    rowsPerPage: input.rowsPerPage
  });
  if (!capacity.fitsHorizontally) {
    throw new Error(
      "Move or resize the schedule so it fits horizontally inside the sheet before creating continuations."
    );
  }
  if (!capacity.fitsVertically) {
    throw new Error(
      `Rows per sheet is too high. Part ${capacity.overflowPageIndexes[0] + 1} would extend beyond the sheet.`
    );
  }

  const pages = collectContinuationPages({
    model,
    continuationSetId,
    sourceSheet,
    sourceAnnotation
  });
  const surplusPages = [...pages.values()].filter(
    (page) => page.pageIndex >= capacity.pageCount
  );
  const unsafeSurplus = surplusPages.find(
    (page) => !isSafeGeneratedContinuationPage(page)
  );
  if (unsafeSurplus) {
    throw new Error(
      `${unsafeSurplus.sheet.name} contains user changes and cannot be removed automatically.`
    );
  }
  const removedSheetIds = surplusPages.map((page) => page.sheet.id);
  if (removedSheetIds.length > 0) {
    const removed = new Set(removedSheetIds);
    model = { ...model, sheets: model.sheets.filter((sheet) => !removed.has(sheet.id)) };
    for (const page of surplusPages) pages.delete(page.pageIndex);
  }

  model = {
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sourceSheet.id
        ? {
            ...sheet,
            annotations: sheet.annotations.map((annotation) =>
              annotation.id === sourceAnnotation.id &&
              isConnectedWireScheduleAnnotation(annotation)
                ? {
                    ...annotation,
                    schedule: {
                      ...annotation.schedule,
                      scope: connectionDisplayModeScheduleScope(displayMode),
                      pagination: {
                        version: 1 as const,
                        continuationSetId,
                        pageIndex: 0,
                        rowsPerPage: input.rowsPerPage
                      }
                    }
                  }
                : annotation
            )
          }
        : sheet
    )
  };

  const createdSheetIds: string[] = [];
  let insertAt = model.sheets.findIndex((sheet) => sheet.id === sourceSheet.id) + 1;
  for (let pageIndex = 1; pageIndex < capacity.pageCount; pageIndex += 1) {
    const existing = pages.get(pageIndex);
    if (existing) {
      const updatedPlacement = clonePresentation(
        existing.placement,
        sourcePlacement,
        displayMode
      );
      const updatedAnnotation = cloneSchedulePresentation({
        source: sourceAnnotation,
        target: existing.annotation,
        sourcePlacementId: updatedPlacement.id,
        continuationSetId,
        pageIndex,
        rowsPerPage: input.rowsPerPage,
        displayMode
      });
      model = {
        ...model,
        sheets: model.sheets.map((sheet) =>
          sheet.id === existing.sheet.id
            ? {
                ...sheet,
                name: isGeneratedContinuationName(sheet.name, pageIndex)
                  ? continuationSheetName(sourceSheet.name, pageIndex, capacity.pageCount)
                  : sheet.name,
                description: isGeneratedContinuationDescription(sheet.description, pageIndex)
                  ? continuationSheetDescription({
                      sourceDescription: sourceSheet.description,
                      pageIndex,
                      pageCount: capacity.pageCount
                    })
                  : sheet.description,
                placements: sheet.placements.map((placement) =>
                  placement.id === existing.placement.id
                    ? updatedPlacement
                    : placement
                ),
                annotations: sheet.annotations.map((annotation) =>
                  annotation.id === existing.annotation.id
                    ? updatedAnnotation
                    : annotation
                )
              }
            : sheet
        )
      };
      continue;
    }

    const created = createDetailedPanelDrawingSheet(
      model,
      {
        mode: "reference",
        panelAssetId: sourceSheet.panelDrawingContext!.panelAssetId,
        name: continuationSheetName(sourceSheet.name, pageIndex, capacity.pageCount),
        description: continuationSheetDescription({
          sourceDescription: sourceSheet.description,
          pageIndex,
          pageCount: capacity.pageCount
        })
      },
      symbols,
      { insertAt }
    );
    const placed = placePanelAssetOccurrence({
      model: created.model,
      sheetId: created.sheetId,
      assetId: sourcePlacement.assetId!,
      symbols
    });
    const placedPresentation = clonePresentation(
      placed.placement,
      sourcePlacement,
      displayMode
    );
    const schedule = cloneSchedulePresentation({
      source: sourceAnnotation,
      target: { ...sourceAnnotation, id: createId("wire_schedule") },
      sourcePlacementId: placedPresentation.id,
      continuationSetId,
      pageIndex,
      rowsPerPage: input.rowsPerPage,
      displayMode
    });
    model = {
      ...placed.model,
      sheets: placed.model.sheets.map((sheet) =>
        sheet.id === created.sheetId
          ? {
              ...sheet,
              placements: sheet.placements.map((placement) =>
                placement.id === placed.placement.id
                  ? placedPresentation
                  : placement
              ),
              annotations: [schedule]
            }
          : sheet
      )
    };
    createdSheetIds.push(created.sheetId);
    insertAt += 1;
  }

  const continuationSheetIds = new Set(
    [...pages.values()]
      .filter((page) => page.pageIndex > 0 && page.pageIndex < capacity.pageCount)
      .map((page) => page.sheet.id)
      .concat(createdSheetIds)
  );
  const sourceIndex = model.sheets.findIndex((sheet) => sheet.id === sourceSheet.id);
  const orderedContinuations = model.sheets
    .filter((sheet) => continuationSheetIds.has(sheet.id))
    .sort((first, second) => {
      const firstPage = first.annotations.find(isConnectedWireScheduleAnnotation)
        ?.schedule.pagination?.pageIndex ?? 0;
      const secondPage = second.annotations.find(isConnectedWireScheduleAnnotation)
        ?.schedule.pagination?.pageIndex ?? 0;
      return firstPage - secondPage;
    });
  model = {
    ...model,
    sheets: [
      ...model.sheets
        .slice(0, sourceIndex + 1)
        .filter((sheet) => !continuationSheetIds.has(sheet.id)),
      ...orderedContinuations,
      ...model.sheets
        .slice(sourceIndex + 1)
        .filter((sheet) => !continuationSheetIds.has(sheet.id))
    ]
  };

  return {
    model: drawingPackageModelSchema.parse(model),
    continuationSetId,
    pageCount: capacity.pageCount,
    createdSheetIds,
    removedSheetIds
  };
}

export function removeConnectedWireSchedulePagination(input: {
  model: DrawingModel;
  sourceSheetId: string;
  sourceAnnotationId: string;
}): RemoveConnectedWireSchedulePaginationResult {
  const model = drawingPackageModelSchema.parse(input.model);
  const { sourceSheet, sourceAnnotation } = getSourceContext({
    model,
    sourceSheetId: input.sourceSheetId,
    sourceAnnotationId: input.sourceAnnotationId
  });
  const continuationSetId = sourceAnnotation.schedule.pagination?.continuationSetId;
  if (!continuationSetId) return { model, removedSheetIds: [] };
  const pages = collectContinuationPages({
    model,
    continuationSetId,
    sourceSheet,
    sourceAnnotation
  });
  const continuations = [...pages.values()].filter((page) => page.pageIndex > 0);
  const unsafe = continuations.find((page) => !isSafeGeneratedContinuationPage(page));
  if (unsafe) {
    throw new Error(
      `${unsafe.sheet.name} contains user changes and prevents removing pagination.`
    );
  }
  const removedSheetIds = continuations.map((page) => page.sheet.id);
  const removed = new Set(removedSheetIds);
  const nextModel: DrawingModel = {
    ...model,
    sheets: model.sheets
      .filter((sheet) => !removed.has(sheet.id))
      .map((sheet) =>
        sheet.id === sourceSheet.id
          ? {
              ...sheet,
              annotations: sheet.annotations.map((annotation) => {
                if (
                  annotation.id !== sourceAnnotation.id ||
                  !isConnectedWireScheduleAnnotation(annotation)
                ) {
                  return annotation;
                }
                const schedule = { ...annotation.schedule };
                delete schedule.pagination;
                return { ...annotation, schedule };
              })
            }
          : sheet
      )
  };
  return {
    model: drawingPackageModelSchema.parse(nextModel),
    removedSheetIds
  };
}
