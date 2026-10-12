import type { DrawingProjectStatus } from "../data/schema";

export type DrawingProjectSummary = {
  id: string;
  name: string;
  projectNumber?: string;
  clientId?: string;
  client?: string;
  status: DrawingProjectStatus;
};

export type DrawingProjectAssignableOption = DrawingProjectSummary;

export type DrawingProjectListItem = DrawingProjectSummary & {
  description?: string;
  drawingCount: number;
  updatedAt: string;
};

export type DrawingProjectListPage = {
  items: DrawingProjectListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  status: DrawingProjectStatus;
};

export type DrawingProjectDetail = DrawingProjectSummary & {
  description?: string;
  drawingCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DrawingProjectDrawingListItem = {
  id: string;
  title: string;
  description?: string;
  status: string;
  updatedAt: string;
};

export type DrawingProjectDrawingListPage = {
  items: DrawingProjectDrawingListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type DrawingProjectActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: "validation" | "not_found" | "unavailable";
      fieldErrors?: Partial<Record<"name" | "clientId", string>>;
    };
