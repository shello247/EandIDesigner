import { z } from "zod";
import { terminalBlockPlacementSchema } from "@/features/drawing_terminal_blocks/data/schema";
import {
  panelDrawingContextSchema,
  panelWiringPackageDataSchema
} from "@/features/drawing_panel_wiring/api/contracts";

export const drawingStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "archived"
]);

export const placementRoleSchema = z.enum([
  "device",
  "cable_assembly",
  "terminal_block",
  "enclosure",
  "other"
]);

export const drawingAssetTypeSchema = z.enum([
  "instrument",
  "controller",
  "panel",
  "junction_box",
  "terminal_block",
  "breaker",
  "fuse",
  "relay",
  "power_supply",
  "isolator",
  "converter",
  "io_module",
  "earth_bar",
  "cable",
  "other"
]);

export const drawingAssetRecordSchema = z.object({
  id: z.string().trim().min(1),
  tag: z.string().trim().min(1).max(120),
  type: drawingAssetTypeSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).optional(),
  symbolId: z.string().trim().min(1).optional(),
  versionId: z.string().trim().min(1).optional(),
  metadata: z
    .object({
      generatedKind: z.string().trim().max(80).optional(),
      symbolKey: z.string().trim().max(160).optional()
    })
    .optional(),
  terminalBlock: terminalBlockPlacementSchema.optional()
});

export const drawingEndpointSchema = z.object({
  placementId: z.string().trim().min(1),
  anchorKey: z.string().trim().min(1)
});

export const drawingRoutePointSchema = z.object({
  id: z.string().trim().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  kind: z.enum(["endpoint", "elbow", "control"])
});

export const drawingConnectionRouteSchema = z.object({
  mode: z.enum(["manual", "auto"]),
  style: z.literal("orthogonal"),
  points: z.array(drawingRoutePointSchema).min(2),
  labelPosition: z
    .object({
      x: z.number().finite(),
      y: z.number().finite()
    })
    .optional(),
  locked: z.boolean().optional()
});

export const drawingPlacementSchema = z.object({
  id: z.string().trim().min(1),
  assetId: z.string().trim().min(1).optional(),
  containerAssetId: z.string().trim().min(1).optional(),
  layoutKind: z.enum(["backplane", "layout_helper"]).optional(),
  layoutParentId: z.string().trim().min(1).optional(),
  panelReference: z
    .object({
      panelAssetId: z.string().trim().min(1),
      referenceKind: z.enum([
        "shield",
        "protective_earth",
        "signal_ground"
      ]),
      key: z.string().trim().min(1).max(120).optional()
    })
    .optional(),
  panelPatternLegend: z
    .object({
      visible: z.boolean().default(true)
    })
    .optional(),
  symbolId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  role: placementRoleSchema,
  tag: z.string().trim().min(1).max(120),
  title: z.string().trim().max(160).optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite(),
  scale: z.number().positive(),
  layoutDimensions: z
    .object({
      lengthMm: z.number().positive(),
      widthMm: z.number().positive()
    })
    .optional(),
  layoutScale: z
    .object({
      mode: z.enum(["auto", "manual"]).default("auto"),
      value: z.number().positive().optional()
    })
    .optional(),
  layoutPosition: z
    .object({
      xMm: z.number().finite(),
      yMm: z.number().finite()
    })
    .optional(),
  layoutLabel: z
    .object({
      visible: z.boolean().optional(),
      position: z
        .enum([
          "center",
          "top-left",
          "top-center",
          "top-right",
          "bottom-left",
          "bottom-center",
          "bottom-right"
        ])
        .optional()
    })
    .optional(),
  layoutDimension: z
    .object({
      orientation: z.enum(["horizontal", "vertical"]),
      startMm: z.number().finite(),
      endMm: z.number().finite(),
      offsetMm: z.number().finite(),
      startWitnessMm: z.number().finite().optional(),
      endWitnessMm: z.number().finite().optional(),
      labelPositionMm: z.number().finite().optional(),
      startAttachment: z
        .object({
          targetKind: z.enum(["backplane", "usable", "placement"]),
          placementId: z.string().trim().min(1).optional(),
          edge: z.enum(["top", "right", "bottom", "left"]),
          ratio: z.number().min(0).max(1)
        })
        .optional(),
      endAttachment: z
        .object({
          targetKind: z.enum(["backplane", "usable", "placement"]),
          placementId: z.string().trim().min(1).optional(),
          edge: z.enum(["top", "right", "bottom", "left"]),
          ratio: z.number().min(0).max(1)
        })
        .optional(),
      labelOverride: z.string().trim().max(80).optional(),
      showValue: z.boolean().optional()
    })
    .optional(),
  labelPosition: z
    .object({
      x: z.number().finite(),
      y: z.number().finite()
    })
    .optional(),
  deviceTitlePosition: z
    .object({
      x: z.number().finite(),
      y: z.number().finite()
    })
    .optional(),
  enclosure: z
    .object({
      kind: z
        .enum(["power_distribution_panel", "junction_box", "generic_enclosure"])
        .default("power_distribution_panel"),
      title: z.string().trim().max(160).optional(),
      width: z.number().positive(),
      height: z.number().positive()
    })
    .optional(),
  terminalBlock: terminalBlockPlacementSchema.optional()
});

export function isNonAssetDrawingPlacement(
  placement: DrawingPlacement
): boolean {
  return Boolean(
    (placement.layoutKind && placement.role === "other") ||
      placement.panelReference ||
      placement.panelPatternLegend
  );
}

export const drawingConnectionSchema = z.object({
  id: z.string().trim().min(1),
  from: drawingEndpointSchema,
  to: drawingEndpointSchema,
  label: z.string().trim().max(160).optional(),
  wireId: z.string().trim().max(80).optional(),
  cablePlacementId: z.string().trim().min(1).optional(),
  conductorKey: z.string().trim().max(80).optional(),
  panelConnectionId: z.string().trim().min(1).optional(),
  panelPatternId: z.string().trim().min(1).optional(),
  panelPatternSegmentId: z.string().trim().min(1).optional(),
  route: drawingConnectionRouteSchema.optional()
});

export const drawingAnnotationSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().max(120).optional(),
  text: z.string().max(400),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  leader: z
    .object({
      enabled: z.boolean(),
      targetX: z.number().finite(),
      targetY: z.number().finite()
    })
    .optional(),
  kind: z.enum(["note", "callout", "title"])
});

export const drawingTitleBlockSchema = z.object({
  client: z.string().trim().max(160).optional(),
  project: z.string().trim().max(200).optional(),
  drawingNumber: z.string().trim().max(120).optional(),
  revision: z.string().trim().max(40).optional(),
  preparedBy: z.string().trim().max(120).optional(),
  checkedBy: z.string().trim().max(120).optional(),
  date: z.string().trim().max(40).optional()
});

export const drawingSheetPageSchema = z.object({
  size: z.literal("A3_LANDSCAPE"),
  width: z.number().positive(),
  height: z.number().positive(),
  gridSize: z.number().positive()
});

export const drawingPackageSheetKindSchema = z.enum([
  "drawing",
  "section_title"
]);

export const drawingSectionTitlePageSchema = z.object({
  title: z.string().trim().max(160).optional(),
  subtitle: z.string().trim().max(400).optional(),
  sectionNumber: z.string().trim().max(80).optional()
});

export const drawingSheetCanvasModelSchema = z.object({
  sheet: drawingSheetPageSchema.extend({
    titleBlock: drawingTitleBlockSchema
  }),
  placements: z.array(drawingPlacementSchema),
  connections: z.array(drawingConnectionSchema),
  annotations: z.array(drawingAnnotationSchema)
});

const legacyDrawingModelSchema = drawingSheetCanvasModelSchema.extend({
  version: z.literal(1)
});

const drawingPackageSheetInputSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  kind: z
    .union([drawingPackageSheetKindSchema, z.literal("panel_layout")])
    .default("drawing"),
  description: z.string().trim().max(400).optional(),
  sectionTitlePage: drawingSectionTitlePageSchema.optional(),
  panelDrawingContext: panelDrawingContextSchema.optional(),
  page: drawingSheetPageSchema,
  placements: z.array(drawingPlacementSchema),
  connections: z.array(drawingConnectionSchema),
  annotations: z.array(drawingAnnotationSchema)
});

export const drawingPackageSheetSchema = drawingPackageSheetInputSchema.transform(
  ({ kind, ...sheet }) => ({
    ...sheet,
    kind: kind === "panel_layout" ? "drawing" : kind
  })
);

export const drawingPackageModelSchema = z.object({
  version: z.literal(2),
  titleBlock: drawingTitleBlockSchema,
  assets: z.array(drawingAssetRecordSchema).default([]),
  panelWiring: panelWiringPackageDataSchema.optional(),
  sheets: z.array(drawingPackageSheetSchema).min(1)
});

export const drawingModelSchema = drawingPackageModelSchema;

export const createDrawingInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  drawingKey: z.string().trim().min(1).max(120).optional()
});

export const saveDrawingInputSchema = z.object({
  drawingId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  model: drawingPackageModelSchema,
  expectedUpdatedAt: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid drawing revision.")
    .optional()
});

export type DrawingStatus = z.infer<typeof drawingStatusSchema>;
export type DrawingAssetType = z.infer<typeof drawingAssetTypeSchema>;
export type DrawingAssetRecord = z.infer<typeof drawingAssetRecordSchema>;
export type DrawingPlacementRole = z.infer<typeof placementRoleSchema>;
export type DrawingEndpoint = z.infer<typeof drawingEndpointSchema>;
export type DrawingRoutePoint = z.infer<typeof drawingRoutePointSchema>;
export type DrawingConnectionRoute = z.infer<
  typeof drawingConnectionRouteSchema
>;
export type DrawingPlacement = z.infer<typeof drawingPlacementSchema>;
export type DrawingConnection = z.infer<typeof drawingConnectionSchema>;
export type DrawingAnnotation = z.infer<typeof drawingAnnotationSchema>;
export type DrawingSheetPage = z.infer<typeof drawingSheetPageSchema>;
export type DrawingPackageSheetKind = z.infer<
  typeof drawingPackageSheetKindSchema
>;
export type DrawingSectionTitlePage = z.infer<
  typeof drawingSectionTitlePageSchema
>;
export type DrawingSheetCanvasModel = z.infer<
  typeof drawingSheetCanvasModelSchema
>;
export type DrawingPackageSheet = z.infer<typeof drawingPackageSheetSchema>;
export type DrawingModel = z.infer<typeof drawingPackageModelSchema>;
type LegacyDrawingModel = z.infer<typeof legacyDrawingModelSchema>;
export type CreateDrawingInput = z.infer<typeof createDrawingInputSchema>;
export type SaveDrawingInput = z.infer<typeof saveDrawingInputSchema>;

export function createDefaultDrawingSheet({
  id = "sheet_1",
  name = "Sheet 1"
}: {
  id?: string;
  name?: string;
} = {}): DrawingPackageSheet {
  return {
    id,
    name,
    kind: "drawing",
    page: {
      size: "A3_LANDSCAPE",
      width: 420,
      height: 297,
      gridSize: 10
    },
    placements: [],
    connections: [],
    annotations: []
  };
}

export function createDefaultDrawingModel(): DrawingModel {
  return {
    version: 2,
    titleBlock: {
      revision: "A",
      date: new Date().toISOString().slice(0, 10)
    },
    assets: [],
    sheets: [createDefaultDrawingSheet()]
  };
}

export function migrateDrawingModelV1ToV2(model: LegacyDrawingModel): DrawingModel {
  return {
    version: 2,
    titleBlock: model.sheet.titleBlock,
    assets: [],
    sheets: [
      {
        id: "sheet_1",
        name: "Sheet 1",
        kind: "drawing",
        page: {
          size: model.sheet.size,
          width: model.sheet.width,
          height: model.sheet.height,
          gridSize: model.sheet.gridSize
        },
        placements: model.placements,
        connections: model.connections,
        annotations: model.annotations
      }
    ]
  };
}

export function createStablePlacementAssetId(placementId: string): string {
  const normalized = placementId
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `asset_${normalized || "placement"}`;
}

export function ensureDrawingModelAssetIds(model: DrawingModel): DrawingModel {
  return {
    ...model,
    sheets: model.sheets.map((sheet) => ({
      ...sheet,
      placements: sheet.placements.map((placement) => {
        if (isNonAssetDrawingPlacement(placement)) {
          return {
            ...placement,
            assetId: undefined
          };
        }

        return {
          ...placement,
          assetId:
            placement.assetId?.trim() ||
            createStablePlacementAssetId(placement.id)
        };
      })
    }))
  };
}

function inferDrawingAssetTypeFromPlacement(
  placement: DrawingPlacement
): DrawingAssetType {
  const tag = placement.tag.trim().toUpperCase();

  if (placement.role === "enclosure") {
    return placement.enclosure?.kind === "junction_box" ? "junction_box" : "panel";
  }

  if (placement.role === "cable_assembly") {
    return "cable";
  }

  if (placement.role === "terminal_block") {
    return tag.startsWith("MCB") ? "breaker" : "terminal_block";
  }

  if (tag.startsWith("TSM") || tag.startsWith("PLC") || tag.startsWith("CTRL")) {
    return "controller";
  }

  if (
    tag.startsWith("TT") ||
    tag.startsWith("LIT") ||
    tag.startsWith("FIT") ||
    tag.startsWith("PIT") ||
    tag.startsWith("INST")
  ) {
    return "instrument";
  }

  return "other";
}

function inferDrawingAssetTitleFromPlacement(placement: DrawingPlacement): string {
  const terminalBlockTitle = placement.terminalBlock?.kind
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    placement.title?.trim() ||
    placement.enclosure?.title?.trim() ||
    terminalBlockTitle ||
    placement.tag
  );
}

function assetRecordFromPlacement(placement: DrawingPlacement): DrawingAssetRecord {
  return drawingAssetRecordSchema.parse({
    id: placementAssetIdForSchema(placement),
    tag: placement.tag,
    type: inferDrawingAssetTypeFromPlacement(placement),
    title: inferDrawingAssetTitleFromPlacement(placement),
    symbolId: placement.symbolId,
    versionId: placement.versionId,
    terminalBlock: placement.terminalBlock,
    metadata: placement.enclosure?.kind
      ? { generatedKind: placement.enclosure.kind }
      : undefined
  });
}

function placementAssetIdForSchema(placement: DrawingPlacement): string {
  return placement.assetId?.trim() || createStablePlacementAssetId(placement.id);
}

export function ensureDrawingModelAssets(model: DrawingModel): DrawingModel {
  const assets = new Map<string, DrawingAssetRecord>();
  const nonAssetPlacementIds = new Set(
    model.sheets.flatMap((sheet) =>
      sheet.placements
        .filter(isNonAssetDrawingPlacement)
        .map(placementAssetIdForSchema)
    )
  );

  for (const asset of model.assets ?? []) {
    if (nonAssetPlacementIds.has(asset.id)) continue;
    assets.set(asset.id, drawingAssetRecordSchema.parse(asset));
  }

  for (const sheet of model.sheets) {
    for (const placement of sheet.placements) {
      if (isNonAssetDrawingPlacement(placement)) {
        continue;
      }

      const assetId = placementAssetIdForSchema(placement);

      if (!assets.has(assetId)) {
        assets.set(assetId, assetRecordFromPlacement(placement));
      }
    }
  }

  return {
    ...model,
    assets: [...assets.values()].sort((first, second) =>
      first.tag.localeCompare(second.tag, undefined, { numeric: true })
    )
  };
}

export function parseDrawingModelJson(modelJson: string): DrawingModel {
  const rawModel: unknown = JSON.parse(modelJson);

  if (
    typeof rawModel === "object" &&
    rawModel !== null &&
    "version" in rawModel &&
    rawModel.version === 1
  ) {
    return ensureDrawingModelAssets(
      ensureDrawingModelAssetIds(
        migrateDrawingModelV1ToV2(legacyDrawingModelSchema.parse(rawModel))
      )
    );
  }

  return ensureDrawingModelAssets(
    ensureDrawingModelAssetIds(drawingPackageModelSchema.parse(rawModel))
  );
}

export function stringifyDrawingModel(model: DrawingModel): string {
  return JSON.stringify(
    drawingPackageModelSchema.parse(
      ensureDrawingModelAssets(ensureDrawingModelAssetIds(model))
    ),
    null,
    2
  );
}
