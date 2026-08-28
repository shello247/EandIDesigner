import type {
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import { isPanelConnectionViewPlacement } from "./drawing-panel-connection-views";
import {
  allocateNextTagFromPrefix,
  createDrawingAssetId,
  normalizeAssetTag,
  placementAssetId
} from "./drawing-asset-identity";
import {
  DEFAULT_PANEL_ENCLOSURE_HEIGHT,
  DEFAULT_PANEL_ENCLOSURE_KIND,
  DEFAULT_PANEL_ENCLOSURE_WIDTH,
  GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
  GENERATED_PANEL_ENCLOSURE_VERSION_ID,
  MIN_PANEL_ENCLOSURE_HEIGHT,
  MIN_PANEL_ENCLOSURE_WIDTH,
  PANEL_ENCLOSURE_TAG_PREFIX,
  type PanelEnclosureKind
} from "./drawing-enclosure-constants";
import {
  centerPhysicalLayoutBounds,
  getPhysicalLayoutPrintableArea,
  maximumAutoScalePhysicalSize,
  PANEL_ENCLOSURE_SCALE_DENOMINATORS,
  resolvePhysicalLayoutScale,
  type PhysicalLayoutBounds,
  type ResolvedPhysicalLayoutScale
} from "./drawing-physical-layout-scale";
export {
  DEFAULT_PANEL_ENCLOSURE_HEIGHT,
  DEFAULT_PANEL_ENCLOSURE_KIND,
  DEFAULT_PANEL_ENCLOSURE_WIDTH,
  GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
  GENERATED_PANEL_ENCLOSURE_VERSION_ID,
  MIN_PANEL_ENCLOSURE_HEIGHT,
  MIN_PANEL_ENCLOSURE_WIDTH,
  PANEL_ENCLOSURE_TAG_PREFIX,
  type PanelEnclosureKind
} from "./drawing-enclosure-constants";

export type PanelAssetPlacementRef = {
  sheetId: string;
  sheetName: string;
  sheetNumber: number;
  placementId: string;
};

export type PanelAssetCatalogItem = {
  assetId: string;
  tag: string;
  normalizedTag: string;
  kind: PanelEnclosureKind;
  title: string;
  placementRefs: PanelAssetPlacementRef[];
};

export function isGeneratedPanelEnclosurePlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & {
  role: "enclosure";
  enclosure: NonNullable<DrawingPlacement["enclosure"]>;
} {
  return Boolean(
    placement &&
      placement.role === "enclosure" &&
      placement.symbolId === GENERATED_PANEL_ENCLOSURE_SYMBOL_ID &&
      placement.versionId === GENERATED_PANEL_ENCLOSURE_VERSION_ID &&
      placement.enclosure
  );
}

export function isLegacyPanelEnclosureLayout(
  placement: DrawingPlacement
): boolean {
  return isGeneratedPanelEnclosurePlacement(placement) && !placement.layoutScale;
}

export function isContainablePlacement(placement: DrawingPlacement): boolean {
  return placement.role !== "enclosure" && placement.role !== "cable_assembly";
}

export function getPanelEnclosureKindLabel(kind: string | undefined): string {
  if (kind === "junction_box") {
    return "Junction Box";
  }

  if (kind === "generic_enclosure") {
    return "Enclosure";
  }

  return "Power Distribution Panel";
}

export function normalizePanelEnclosureTitle(
  title: string | undefined,
  kind: string | undefined
): string {
  const normalized = title?.trim();

  return normalized || getPanelEnclosureKindLabel(kind);
}

export function getPanelEnclosureTitle(placement: DrawingPlacement): string {
  return normalizePanelEnclosureTitle(
    placement.enclosure?.title,
    placement.enclosure?.kind
  );
}

export function getPanelEnclosureBounds(placement: DrawingPlacement) {
  return {
    x: placement.x,
    y: placement.y,
    width: placement.enclosure?.width ?? DEFAULT_PANEL_ENCLOSURE_WIDTH,
    height: placement.enclosure?.height ?? DEFAULT_PANEL_ENCLOSURE_HEIGHT
  };
}

export function createPanelEnclosurePlacement({
  model,
  activeSheet,
  assetId,
  tag,
  x,
  y,
  width = DEFAULT_PANEL_ENCLOSURE_WIDTH,
  height = DEFAULT_PANEL_ENCLOSURE_HEIGHT,
  kind = DEFAULT_PANEL_ENCLOSURE_KIND,
  title
}: {
  model: DrawingModel;
  activeSheet: DrawingPackageSheet;
  assetId?: string;
  tag?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  kind?: PanelEnclosureKind;
  title?: string;
}): DrawingPlacement {
  const normalizedTag =
    tag?.trim() ||
    allocateNextTagFromPrefix({
      model,
      prefix: PANEL_ENCLOSURE_TAG_PREFIX
    });
  const placementId = `panel_${Date.now()}`;
  const panelWidth = Math.max(MIN_PANEL_ENCLOSURE_WIDTH, width);
  const panelHeight = Math.max(MIN_PANEL_ENCLOSURE_HEIGHT, height);
  const sheet = {
    ...activeSheet.page,
    titleBlock: model.titleBlock
  };
  const scale = resolvePhysicalLayoutScale({
    sheet,
    physicalWidth: panelWidth,
    physicalHeight: panelHeight,
    denominators: PANEL_ENCLOSURE_SCALE_DENOMINATORS
  });
  const displayWidth = panelWidth * scale.factor;
  const displayHeight = panelHeight * scale.factor;

  return {
    id: placementId,
    assetId: assetId?.trim() || createDrawingAssetId(placementId),
    symbolId: GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
    versionId: GENERATED_PANEL_ENCLOSURE_VERSION_ID,
    role: "enclosure",
    tag: normalizedTag,
    x: Math.max(0, Math.min(activeSheet.page.width - displayWidth, x ?? 24)),
    y: Math.max(0, Math.min(activeSheet.page.height - displayHeight, y ?? 28)),
    rotation: 0,
    scale: 1,
    layoutScale: {
      mode: "auto"
    },
    enclosure: {
      kind,
      title: normalizePanelEnclosureTitle(title, kind),
      width: panelWidth,
      height: panelHeight
    }
  };
}

export function buildPanelAssetCatalog(
  model: DrawingModel
): PanelAssetCatalogItem[] {
  const catalog = new Map<string, PanelAssetCatalogItem>();

  (model.assets ?? [])
    .filter((asset) => asset.type === "panel" || asset.type === "junction_box")
    .forEach((asset) => {
      const kind: PanelEnclosureKind =
        asset.type === "junction_box"
          ? "junction_box"
          : "power_distribution_panel";

      catalog.set(asset.id, {
        assetId: asset.id,
        tag: asset.tag,
        normalizedTag: normalizeAssetTag(asset.tag),
        kind,
        title: asset.title,
        placementRefs: []
      });
    });

  model.sheets.forEach((sheet, sheetIndex) => {
    sheet.placements
      .filter(isGeneratedPanelEnclosurePlacement)
      .forEach((placement) => {
        const assetId = placementAssetId(placement);
        const placementRef: PanelAssetPlacementRef = {
          sheetId: sheet.id,
          sheetName: sheet.name,
          sheetNumber: sheetIndex + 1,
          placementId: placement.id
        };
        const current = catalog.get(assetId);

        if (current) {
          current.placementRefs.push(placementRef);
          return;
        }

        catalog.set(assetId, {
          assetId,
          tag: placement.tag,
          normalizedTag: normalizeAssetTag(placement.tag),
          kind: placement.enclosure.kind,
          title: getPanelEnclosureTitle(placement),
          placementRefs: [placementRef]
        });
      });
  });

  return [...catalog.values()].sort((first, second) =>
    first.tag.localeCompare(second.tag, undefined, { numeric: true })
  );
}

export function getVisibleSheetContainers(
  model: DrawingSheetCanvasModel
): Array<ReturnType<typeof getPanelEnclosureBounds> & {
  placement: DrawingPlacement;
  assetId: string;
}> {
  return model.placements
    .filter(isGeneratedPanelEnclosurePlacement)
    .map((placement) => ({
      ...getPanelEnclosureDisplayBounds(model.sheet, placement),
      placement,
      assetId: placementAssetId(placement)
    }));
}

export function assignPlacementToContainer(
  model: DrawingSheetCanvasModel,
  placementId: string,
  containerAssetId: string
): DrawingSheetCanvasModel {
  const normalizedContainerAssetId = containerAssetId.trim();

  if (!normalizedContainerAssetId) {
    return clearPlacementContainer(model, placementId);
  }

  const hasVisibleContainer = model.placements.some(
    (placement) =>
      isGeneratedPanelEnclosurePlacement(placement) &&
      placementAssetId(placement) === normalizedContainerAssetId
  );

  if (!hasVisibleContainer) {
    return model;
  }

  return {
    ...model,
    placements: model.placements.map((placement) =>
      placement.id === placementId && isContainablePlacement(placement)
        ? {
            ...placement,
            containerAssetId: normalizedContainerAssetId
          }
        : placement
    )
  };
}

export function clearPlacementContainer(
  model: DrawingSheetCanvasModel,
  placementId: string
): DrawingSheetCanvasModel {
  return {
    ...model,
    placements: model.placements.map((placement) =>
      placement.id === placementId
        ? {
            ...placement,
            containerAssetId: undefined
          }
        : placement
    )
  };
}

export function containedPlacementIdsForPanels(
  model: DrawingSheetCanvasModel,
  panelPlacementIds: Iterable<string>
): string[] {
  const selectedPanels = [...panelPlacementIds].flatMap((placementId) => {
    const placement = model.placements.find(
      (candidate) => candidate.id === placementId
    );
    return placement ? [placement] : [];
  });
  const panelAssetIds = new Set(
    selectedPanels
      .filter(isGeneratedPanelEnclosurePlacement)
      .map(placementAssetId)
  );
  const connectionViewIds = new Set(
    selectedPanels.filter(isPanelConnectionViewPlacement).map(({ id }) => id)
  );

  if (panelAssetIds.size === 0 && connectionViewIds.size === 0) {
    return [];
  }

  return model.placements
    .filter(
      (placement) =>
        !isGeneratedPanelEnclosurePlacement(placement) &&
        !isPanelConnectionViewPlacement(placement) &&
        Boolean(
          (placement.containerAssetId &&
            panelAssetIds.has(placement.containerAssetId)) ||
            (placement.layoutParentId &&
              connectionViewIds.has(placement.layoutParentId))
        )
    )
    .map((placement) => placement.id);
}

export function resizePanelEnclosure(
  placement: DrawingPlacement,
  updates: {
    x: number;
    y: number;
    width: number;
    height: number;
  }
): DrawingPlacement {
  return {
    ...placement,
    x: updates.x,
    y: updates.y,
    enclosure: {
      kind: placement.enclosure?.kind ?? DEFAULT_PANEL_ENCLOSURE_KIND,
      title: normalizePanelEnclosureTitle(
        placement.enclosure?.title,
        placement.enclosure?.kind
      ),
      width: Math.max(MIN_PANEL_ENCLOSURE_WIDTH, updates.width),
      height: Math.max(MIN_PANEL_ENCLOSURE_HEIGHT, updates.height)
    }
  };
}

export function resolvePanelEnclosureLayoutScale(
  sheet: { width: number; height: number },
  placement: DrawingPlacement
): ResolvedPhysicalLayoutScale {
  // Enclosures created before hierarchical physical scaling stored their
  // dimensions directly in sheet coordinates. Preserve that geometry until
  // an engineer explicitly fits or edits the panel, which writes layoutScale.
  if (isLegacyPanelEnclosureLayout(placement)) {
    return resolvePhysicalLayoutScale({
      sheet,
      physicalWidth:
        placement.enclosure?.width ?? DEFAULT_PANEL_ENCLOSURE_WIDTH,
      physicalHeight:
        placement.enclosure?.height ?? DEFAULT_PANEL_ENCLOSURE_HEIGHT,
      layoutScale: { mode: "manual", value: 1 },
      denominators: PANEL_ENCLOSURE_SCALE_DENOMINATORS
    });
  }

  return resolvePhysicalLayoutScale({
    sheet,
    physicalWidth:
      placement.enclosure?.width ?? DEFAULT_PANEL_ENCLOSURE_WIDTH,
    physicalHeight:
      placement.enclosure?.height ?? DEFAULT_PANEL_ENCLOSURE_HEIGHT,
    layoutScale: placement.layoutScale,
    denominators: PANEL_ENCLOSURE_SCALE_DENOMINATORS
  });
}

export function getPanelEnclosureDisplayBounds(
  sheet: { width: number; height: number },
  placement: DrawingPlacement
): PhysicalLayoutBounds {
  const physicalBounds = getPanelEnclosureBounds(placement);
  const scale = resolvePanelEnclosureLayoutScale(sheet, placement);

  return {
    x: placement.x,
    y: placement.y,
    width: Number((physicalBounds.width * scale.factor).toFixed(2)),
    height: Number((physicalBounds.height * scale.factor).toFixed(2))
  };
}

export function getPanelEnclosureCenteredPosition(
  sheet: { width: number; height: number },
  placement: DrawingPlacement
): Pick<PhysicalLayoutBounds, "x" | "y"> {
  const physicalBounds = getPanelEnclosureBounds(placement);

  return centerPhysicalLayoutBounds({
    area: getPhysicalLayoutPrintableArea(sheet),
    physicalWidth: physicalBounds.width,
    physicalHeight: physicalBounds.height,
    scale: resolvePanelEnclosureLayoutScale(sheet, placement)
  });
}

export function constrainPanelEnclosureDimensions({
  placement,
  sheet,
  containedBounds,
  width,
  height
}: {
  placement: DrawingPlacement;
  sheet: { width: number; height: number };
  containedBounds: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  width: number;
  height: number;
}): { width: number; height: number } {
  const displayBounds = getPanelEnclosureDisplayBounds(sheet, placement);
  const scale = resolvePanelEnclosureLayoutScale(sheet, placement);
  const maximumSize = maximumAutoScalePhysicalSize(sheet);
  const contentWidth = containedBounds.reduce(
    (maximum, bounds) =>
      Math.max(
        maximum,
        (bounds.x + bounds.width - displayBounds.x) / scale.factor
      ),
    MIN_PANEL_ENCLOSURE_WIDTH
  );
  const contentHeight = containedBounds.reduce(
    (maximum, bounds) =>
      Math.max(
        maximum,
        (bounds.y + bounds.height - displayBounds.y) / scale.factor
      ),
    MIN_PANEL_ENCLOSURE_HEIGHT
  );

  return {
    width: Number(
      Math.min(maximumSize.width, Math.max(contentWidth, width)).toFixed(2)
    ),
    height: Number(
      Math.min(maximumSize.height, Math.max(contentHeight, height)).toFixed(2)
    )
  };
}

export function updatePanelEnclosureTitle(
  model: DrawingModel,
  assetId: string,
  title: string
): DrawingModel {
  const normalizedTitle = title.trim();

  return {
    ...model,
    sheets: model.sheets.map((sheet) => ({
      ...sheet,
      placements: sheet.placements.map((placement) => {
        if (
          !isGeneratedPanelEnclosurePlacement(placement) ||
          placementAssetId(placement) !== assetId
        ) {
          return placement;
        }

        return {
          ...placement,
          enclosure: {
            ...placement.enclosure,
            title: normalizePanelEnclosureTitle(
              normalizedTitle,
              placement.enclosure.kind
            )
          }
        };
      })
    }))
  };
}
