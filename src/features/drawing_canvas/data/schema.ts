import { z } from "zod";
import { deviceTypeSchema } from "@/shared/device-classification/device-types";
import {drawingProductSelectionSchema,engineeringProjectSettingsSchema} from "@/features/item_engineering/api/contracts";
import {
  structuredTerminalStripSchema,
  terminalBlockPlacementSchema
} from "@/features/drawing_terminal_blocks/data/schema";
import {
  panelConnectionDisplayModeSchema,
  panelDrawingContextSchema,
  panelWiringPackageDataSchema
} from "@/features/drawing_panel_wiring/api/contracts";
import { drawingComponentSelectionsSchema } from "@/features/symbol_components/api/public";
import { connectedWireScheduleAnnotationSchema } from "@/features/drawing_connected_wire_schedule/api/public";
import { engineeringAttributeContainerSchema } from "@/features/engineering_attributes/api/public";
import {
  drawingDescriptionSchema,
  drawingProjectAssignmentSchema
} from "@/features/drawing_projects/api/public";

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

export const drawingAssetTypeSchema = deviceTypeSchema;

export const drawingAssetRecordSchema = z.object({
  productSelection: drawingProductSelectionSchema.optional(),
  engineeringSettings: engineeringProjectSettingsSchema.optional(),
  id: z.string().trim().min(1),
  tag: z.string().trim().min(1).max(120),
  type: drawingAssetTypeSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).optional(),
  symbolId: z.string().trim().min(1).optional(),
  versionId: z.string().trim().min(1).optional(),
  componentSelections: drawingComponentSelectionsSchema.optional(),
  metadata: z
    .object({
      generatedKind: z.string().trim().max(80).optional(),
      symbolKey: z.string().trim().max(160).optional()
    })
    .optional(),
  terminalBlock: terminalBlockPlacementSchema.optional(),
  terminalStrip: structuredTerminalStripSchema.optional(),
  engineeringAttributes: engineeringAttributeContainerSchema.optional()
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
  panelConnectionView: z
    .object({
      kind: z.literal("schematic_reference"),
      sourceBackplanePlacementId: z.string().trim().min(1),
      displayWidth: z.number().positive(),
      displayHeight: z.number().positive()
    })
    .optional(),
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
  connectionDisplayMode: panelConnectionDisplayModeSchema.optional(),
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
      size: z.enum(["compact", "standard", "large"]).optional(),
      rotation: z.union([z.literal(0), z.literal(90), z.literal(270)]).optional(),
      leader: z.boolean().optional(),
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

const drawingTextAnnotationSchema = z.object({
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

export const drawingAnnotationSchema = z.union([
  drawingTextAnnotationSchema,
  connectedWireScheduleAnnotationSchema
]);

export const drawingListPageSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
  .catch(1);

export function parseDrawingListPage(input: unknown): number {
  return drawingListPageSchema.parse(input);
}

export const drawingTitleBlockSchema = z.object({
  client: z.string().trim().max(160).optional(),
  project: z.string().trim().max(200).optional(),
  drawingNumber: z.string().trim().max(120).optional(),
  revision: z.string().trim().max(40).optional(),
  preparedBy: z.string().trim().max(120).optional(),
  checkedBy: z.string().trim().max(120).optional(),
  date: z.string().trim().max(40).optional()
});

export const drawingMeasurementUnitSchema = z.enum(["mm", "in"]);

export const titleSheetDraftSchema = z.object({
  title: z.string().trim().min(1, "Enter a drawing title.").max(200),
  titleBlock: drawingTitleBlockSchema
});
export type TitleSheetDraft = z.infer<typeof titleSheetDraftSchema>;

export const drawingSettingsDraftSchema = z.object({
  title: z.string().trim().min(1, "Enter a drawing title.").max(200),
  description: drawingDescriptionSchema,
  projectId: drawingProjectAssignmentSchema,
  titleBlock: drawingTitleBlockSchema,
  measurementUnit: drawingMeasurementUnitSchema
});

export const drawingSheetPageSchema = z.object({
  size: z.literal("A3_LANDSCAPE"),
  width: z.number().positive(),
  height: z.number().positive(),
  gridSize: z.number().positive()
});

export const drawingPackageSheetKindSchema = z.enum([
  "drawing",
  "title_sheet",
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

export const sheetSettingsDraftSchema = z.object({
  name: z.string().trim().min(1, "Enter a sheet name.").max(120),
  description: z.string().trim().max(400).optional(),
  sectionTitlePage: drawingSectionTitlePageSchema.optional(),
  targetSectionId: z.string().trim().min(1).optional(),
  panelAssetId: z.string().trim().min(1).optional()
});

export const drawingPackageModelSchema = z.object({
  version: z.union([z.literal(2),z.literal(3)]),
  measurementUnit: drawingMeasurementUnitSchema.default("mm"),
  titleBlock: drawingTitleBlockSchema,
  assets: z.array(drawingAssetRecordSchema).default([]),
  panelWiring: panelWiringPackageDataSchema.optional(),
  sheets: z.array(drawingPackageSheetSchema).min(1).superRefine((sheets, context) => {
    sheets.forEach((sheet, index) => {
      if (sheet.kind !== "title_sheet") return;
      if (index !== 0) {
        context.addIssue({ code: "custom", path: [index, "kind"], message: "The package Title Sheet must be the first and only Title Sheet." });
      }
      if (sheet.placements.length || sheet.connections.length || sheet.annotations.length || sheet.panelDrawingContext || sheet.sectionTitlePage) {
        context.addIssue({ code: "custom", path: [index, "kind"], message: "A Title Sheet uses shared drawing information, not drawing objects or section details." });
      }
    });
  })
}).superRefine((model,ctx)=>{
  if(model.version===3){
    if(new Set(model.assets.map(a=>a.id)).size!==model.assets.length)ctx.addIssue({code:"custom",path:["assets"],message:"Physical asset identities must be unique."});
    return;
  }
  const hasProducts=(rows:Array<{productSelection?:unknown;engineeringSettings?:unknown;children?:unknown[]}>,depth=0):boolean=>depth>16||rows.some(r=>r.productSelection||r.engineeringSettings||r.children&&hasProducts(r.children as typeof rows,depth+1));
  if(model.assets.some(a=>a.productSelection||a.engineeringSettings||hasProducts(a.componentSelections??[])||a.terminalStrip?.members.some(m=>m.productSelection||m.engineeringSettings||hasProducts(m.componentSelections??[]))))
    ctx.addIssue({code:"custom",path:["version"],message:"Explicit product selection requires drawing model version 3."});
});

export const drawingModelSchema = drawingPackageModelSchema;

export const createDrawingInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: drawingDescriptionSchema,
  projectId: drawingProjectAssignmentSchema.refine((value) => Boolean(value), {
    message: "Open an active project to create a drawing."
  })
});

export const saveDrawingInputSchema = z.object({
  drawingId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  description: drawingDescriptionSchema,
  projectId: drawingProjectAssignmentSchema,
  model: drawingPackageModelSchema,
  expectedUpdatedAt: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid drawing revision.")
    .optional()
});

export type DrawingStatus = z.infer<typeof drawingStatusSchema>;
export type DrawingMeasurementUnit = z.infer<
  typeof drawingMeasurementUnitSchema
>;
export type DrawingSettingsDraft = z.infer<typeof drawingSettingsDraftSchema>;
export type SheetSettingsDraft = z.infer<typeof sheetSettingsDraftSchema>;
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

export function createTitleSheet(id = "sheet_1"): DrawingPackageSheet {
  return { ...createDefaultDrawingSheet({ id, name: "Title Sheet" }), kind: "title_sheet" };
}

// The plain model remains useful for legacy fixtures and programmatic drawing
// authoring. User-created packages explicitly request the cover at creation.
export function createDefaultDrawingModel({ withTitleSheet = false }: { withTitleSheet?: boolean } = {}): DrawingModel {
  return {
    version: 2,
    measurementUnit: "mm",
    titleBlock: {
      revision: "A",
      date: new Date().toISOString().slice(0, 10)
    },
    assets: [],
    sheets: [withTitleSheet ? createTitleSheet() : createDefaultDrawingSheet()]
  };
}

export function migrateDrawingModelV1ToV2(model: LegacyDrawingModel): DrawingModel {
  return {
    version: 2,
    measurementUnit: "mm",
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
  model = preserveComponentAssetPlacements(model);
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

// Older component placements were incorrectly saved with the decorative-helper
// role. Preserve any explicit component record before stripping helper IDs.
// This works without a symbol catalogue, including import/export and BOM reads.
function preserveComponentAssetPlacements(model: DrawingModel): DrawingModel {
  const componentAssets = new Map(
    (model.assets ?? []).filter((asset) => asset.componentSelections !== undefined)
      .map((asset) => [asset.id, asset])
  );
  if (componentAssets.size === 0) return model;
  let changed = false;
  const sheets = model.sheets.map((sheet) => {
    let sheetChanged = false;
    const placements = sheet.placements.map((placement) => {
      const asset = componentAssets.get(placementAssetIdForSchema(placement));
      if (
        placement.layoutKind !== "layout_helper" || placement.role !== "other" ||
        placement.panelReference || placement.panelPatternLegend || !asset ||
        asset.symbolId !== placement.symbolId || asset.versionId !== placement.versionId
      ) return placement;
      changed = sheetChanged = true;
      return { ...placement, role: "device" as const };
    });
    return sheetChanged ? { ...sheet, placements } : sheet;
  });
  return changed ? { ...model, sheets } : model;
}

export function ensureDrawingModelAssets(model: DrawingModel): DrawingModel {
  model = preserveComponentAssetPlacements(model);
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
