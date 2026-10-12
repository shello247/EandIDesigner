import { drawingProjectIdSchema } from "../../data/schema";
import { findDrawingProjectAssignment } from "../../data/queries";
import { DrawingProjectDomainError } from "../../data/mutations";
import type { DrawingProjectSummary } from "../../types";

export async function resolveDrawingProjectAssignment({
  projectId,
  currentProjectId
}: {
  projectId?: string;
  currentProjectId?: string | null;
}): Promise<DrawingProjectSummary | null> {
  if (!projectId) return null;
  const parsedId = drawingProjectIdSchema.parse(projectId);
  const project = await findDrawingProjectAssignment(parsedId);
  if (!project) {
    throw new DrawingProjectDomainError(
      "The selected Project is unavailable.",
      "not_found"
    );
  }
  if (project.status !== "active" && project.id !== currentProjectId) {
    throw new DrawingProjectDomainError(
      "The selected Project is archived and cannot receive new assignments.",
      "archived"
    );
  }
  return {
    id: project.id,
    name: project.name,
    projectNumber: project.projectNumber ?? undefined,
    clientId: project.clientId ?? undefined,
    client: project.client ?? undefined,
    status: project.status === "archived" ? "archived" : "active"
  };
}
