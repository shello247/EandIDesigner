import type {
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
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

  return {
    id: placementId,
    assetId: assetId?.trim() || createDrawingAssetId(placementId),
    symbolId: GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
    versionId: GENERATED_PANEL_ENCLOSURE_VERSION_ID,
    role: "enclosure",
    tag: normalizedTag,
    x: Math.max(0, Math.min(activeSheet.page.width - panelWidth, x ?? 24)),
    y: Math.max(0, Math.min(activeSheet.page.height - panelHeight, y ?? 28)),
    rotation: 0,
    scale: 1,
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
      ...getPanelEnclosureBounds(placement),
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
  const panelAssetIds = new Set(
    [...panelPlacementIds].flatMap((placementId) => {
      const placement = model.placements.find(
        (candidate) => candidate.id === placementId
      );

      return isGeneratedPanelEnclosurePlacement(placement)
        ? [placementAssetId(placement)]
        : [];
    })
  );

  if (panelAssetIds.size === 0) {
    return [];
  }

  return model.placements
    .filter(
      (placement) =>
        !isGeneratedPanelEnclosurePlacement(placement) &&
        Boolean(
          placement.containerAssetId &&
            panelAssetIds.has(placement.containerAssetId)
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
