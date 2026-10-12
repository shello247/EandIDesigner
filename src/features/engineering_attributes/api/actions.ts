"use server";
import { z } from "zod";
import { AttributeTypeError } from "../data/type-schema";
import { getCurrentAttributeType, getAttributeTypeRevision, listAttributeTypes, saveAttributeType, setAttributeTypeStatus } from "../data/type-catalogue";

async function result<T>(operation: () => Promise<T>) {
  try { return { ok: true as const, data: await operation() }; }
  catch (error) {
    const fieldErrors: Record<string, string[]> = {};
    if (error instanceof z.ZodError) for (const issue of error.issues) (fieldErrors[issue.path.join(".") || "_form"] ??= []).push(issue.message);
    return { ok: false as const, code: error instanceof AttributeTypeError ? error.code : error instanceof z.ZodError ? "VALIDATION" : "UNEXPECTED",
      fieldErrors,
      error: error instanceof AttributeTypeError ? error.message : error instanceof z.ZodError ? error.issues[0].message : "The type library could not be updated. Refresh and retry." };
  }
}
export async function listAttributeTypesAction(input: unknown) { return result(() => listAttributeTypes(input)); }
export async function saveAttributeTypeAction(input: unknown) { return result(() => saveAttributeType(input)); }
export async function setAttributeTypeStatusAction(input: unknown) { return result(() => setAttributeTypeStatus(input)); }
export async function loadAttributeTypeRevisionAction(input: unknown) {
  return result(() => getAttributeTypeRevision(z.string().min(1).parse(input)));
}
export async function loadCurrentAttributeTypeAction(input: unknown) {
  return result(() => getCurrentAttributeType(z.string().min(1).parse(input)));
}
