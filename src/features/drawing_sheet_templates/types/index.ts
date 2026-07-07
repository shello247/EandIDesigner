import type {
  DrawingSheetTemplateMetadata,
  DrawingSheetTemplateModel,
  DrawingSheetTemplateStatus
} from "../data/schema";

export type DrawingSheetTemplateListItem = {
  id: string;
  templateKey: string;
  name: string;
  description?: string | null;
  category?: string | null;
  status: DrawingSheetTemplateStatus;
  assetCount: number;
  requiredSymbolCount: number;
  keywords: string[];
  updatedAt: string;
};

export type DrawingSheetTemplateDetail = DrawingSheetTemplateListItem & {
  model: DrawingSheetTemplateModel;
  metadata: DrawingSheetTemplateMetadata;
  sourceDrawingId?: string | null;
  sourceSheetId?: string | null;
  createdAt: string;
};

export type TemplateActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
