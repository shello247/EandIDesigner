"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createDrawingProjectInputSchema,
  setDrawingProjectStatusInputSchema,
  updateDrawingProjectInputSchema
} from "../data/schema";
import { DrawingProjectDomainError } from "../data/mutations";
import {
  createDrawingProject,
  listAssignableDrawingProjects,
  setDrawingProjectStatus,
  updateDrawingProject
} from "./server";
import type {
  DrawingProjectActionResult,
  DrawingProjectAssignableOption,
  DrawingProjectDetail
} from "../types";

function formValue(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? "").trim();
  return value || undefined;
}

function actionError<T>(error: unknown): DrawingProjectActionResult<T> {
  if (error instanceof DrawingProjectDomainError) {
    return {
      ok: false,
      error: error.message,
      code: error.code === "not_found" ? "not_found" : "validation",
      fieldErrors:
        error.code === "client_not_found"
          ? { clientId: error.message }
          : undefined
    };
  }
  if (error instanceof z.ZodError) {
    const messageFor = (field: "name" | "clientId") =>
      error.issues.find((issue) => issue.path[0] === field)?.message;
    return {
      ok: false,
      error: error.issues[0]?.message ?? "Check the highlighted Project fields.",
      code: "validation",
      fieldErrors: {
        name: messageFor("name"),
        clientId: messageFor("clientId")
      }
    };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Unexpected server error."
  };
}

function revalidateProjectConsumers(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/drawings");
  revalidatePath("/drawings/new");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createDrawingProjectAction(
  formData: FormData
): Promise<DrawingProjectActionResult<DrawingProjectDetail>> {
  try {
    const input = createDrawingProjectInputSchema.parse({
      name: formValue(formData, "name") ?? "",
      clientId: formValue(formData, "clientId"),
      description: formValue(formData, "description")
    });
    const project = await createDrawingProject(input);
    if (!project) throw new Error("Project could not be created.");
    revalidateProjectConsumers(project.id);
    return { ok: true, data: project };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateDrawingProjectAction(
  formData: FormData
): Promise<DrawingProjectActionResult<DrawingProjectDetail>> {
  try {
    const input = updateDrawingProjectInputSchema.parse({
      projectId: formValue(formData, "projectId") ?? "",
      name: formValue(formData, "name") ?? "",
      clientId: formValue(formData, "clientId"),
      description: formValue(formData, "description")
    });
    const project = await updateDrawingProject(input);
    if (!project) throw new Error("Project could not be updated.");
    revalidateProjectConsumers(project.id);
    return { ok: true, data: project };
  } catch (error) {
    return actionError(error);
  }
}

export async function setDrawingProjectStatusAction(input: {
  projectId: string;
  status: "active" | "archived";
}): Promise<DrawingProjectActionResult<DrawingProjectDetail>> {
  try {
    const parsed = setDrawingProjectStatusInputSchema.parse(input);
    const project = await setDrawingProjectStatus(parsed);
    if (!project) throw new Error("Project could not be updated.");
    revalidateProjectConsumers(project.id);
    return { ok: true, data: project };
  } catch (error) {
    return actionError(error);
  }
}

export async function loadAssignableDrawingProjectsAction(
  currentProjectId?: string
): Promise<DrawingProjectActionResult<DrawingProjectAssignableOption[]>> {
  try {
    return {
      ok: true,
      data: await listAssignableDrawingProjects(currentProjectId)
    };
  } catch (error) {
    return actionError(error);
  }
}
