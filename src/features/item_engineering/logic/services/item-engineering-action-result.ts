import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AttributeTypeError } from "@/features/engineering_attributes/api/public";
import type { ItemEngineeringActionResult } from "../../types";
import { ItemEngineeringError } from "./item-engineering-revision";

export async function itemEngineeringActionResult<T>(operation: () => Promise<T>): Promise<ItemEngineeringActionResult<T>> {
  try { return { ok: true, data: await operation() }; }
  catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.issues) (fieldErrors[issue.path.join(".") || "_form"] ??= []).push(issue.message);
      return { ok: false, code: "VALIDATION", fieldErrors,
        error: [...new Set(error.issues.map(issue => issue.message))].join("\n") || "Invalid Item engineering data." };
    }
    if (error instanceof ItemEngineeringError) return { ok: false, code: error.code, error: error.message };
    if (error instanceof AttributeTypeError) return { ok: false, code: "VALIDATION", error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P1008", "P2028"].includes(error.code)) {
      return { ok: false, code: "REVISION_CONFLICT", error: "Item data changed or is busy. Reload before saving again." };
    }
    return { ok: false, code: "UNEXPECTED", error: "The Item engineering operation could not be completed. Please retry." };
  }
}
