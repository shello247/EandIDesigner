import type { DrawingProjectSummary } from "@/features/drawing_projects/api/public";
import type { DrawingSettingsDraft } from "../../data/schema";
import { drawingTitleBlockFields } from "./drawing-title-fields";

export type DrawingSettingsTab = "general" | "printed";
export type DrawingSettingsField = "title" | "description" | "projectId" | "measurementUnit" |
  `titleBlock.${keyof DrawingSettingsDraft["titleBlock"]}`;
export type DrawingSettingsIssue = { field: DrawingSettingsField; tab: DrawingSettingsTab; message: string };
const optionalText = (value?: string) => value?.trim() || undefined;

/** Matches existing Apply normalization without validating or changing the model. */
export function normalizeDrawingSettingsDraft(draft: DrawingSettingsDraft): DrawingSettingsDraft {
  return {
    title: draft.title.trim(), description: optionalText(draft.description),
    projectId: optionalText(draft.projectId), measurementUnit: draft.measurementUnit,
    titleBlock: Object.fromEntries(drawingTitleBlockFields.map(({ key }) => [key, optionalText(draft.titleBlock[key])]))
  };
}

export function isDrawingSettingsDirty(draft: DrawingSettingsDraft, initial: DrawingSettingsDraft): boolean {
  return JSON.stringify(normalizeDrawingSettingsDraft(draft)) !== JSON.stringify(normalizeDrawingSettingsDraft(initial));
}

export function mapDrawingSettingsIssues(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): DrawingSettingsIssue[] {
  const result: DrawingSettingsIssue[] = [];
  for (const issue of issues) {
    const path = issue.path.join(".");
    const printed = drawingTitleBlockFields.some(({ key }) => path === `titleBlock.${key}`);
    const field: DrawingSettingsField = printed ? path as DrawingSettingsField :
      (["title", "description", "projectId", "measurementUnit"].includes(path) ? path as DrawingSettingsField : "title");
    if (!result.some(entry => entry.field === field)) result.push({ field, tab: printed ? "printed" : "general", message: issue.message });
  }
  return result;
}

type ProjectCopyField = "client" | "project";
export type ProjectCopyProposal = {
  sourceKey: string;
  changes: Array<{ field: ProjectCopyField; label: string; before: string; after: string }>;
  missingFields: string[];
};

export function projectCopySourceKey(project: DrawingProjectSummary | null): string {
  return JSON.stringify(project ? [project.id, optionalText(project.name), optionalText(project.client)] : null);
}

export function buildProjectCopyProposal(titleBlock: DrawingSettingsDraft["titleBlock"], project: DrawingProjectSummary): ProjectCopyProposal {
  const proposal: ProjectCopyProposal = { sourceKey: projectCopySourceKey(project), changes: [], missingFields: [] };
  for (const field of ["client", "project"] as const) {
    const label = drawingTitleBlockFields.find(entry => entry.key === field)!.label;
    const after = optionalText(field === "client" ? project.client : project.name);
    const before = optionalText(titleBlock[field]) ?? "";
    if (!after) proposal.missingFields.push(label);
    else if (after !== before) proposal.changes.push({ field, label, before, after });
  }
  return proposal;
}

/** Never apply a proposal built from a different or refreshed project. */
export function applyProjectCopyProposal(titleBlock: DrawingSettingsDraft["titleBlock"], proposal: ProjectCopyProposal, project: DrawingProjectSummary | null): DrawingSettingsDraft["titleBlock"] | null {
  if (!project || proposal.sourceKey !== projectCopySourceKey(project)) return null;
  return { ...titleBlock, ...Object.fromEntries(proposal.changes.map(change => [change.field, change.after])) };
}
