import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { referenceSeeds, candidateSeeds } from "./standard-reference-seeds";
import { getCurrent } from "./queries";
import { saveContent } from "./mutations";
import type { Revision } from "../types";
export async function seedStandards(db: PrismaClient = prisma) {
  const sourceMap = new Map<string, Revision<"reference">>();
  for (const seed of referenceSeeds) {
    const existing = await db.standardReference.findFirst({ where: { key: [seed.content.publisher, seed.content.designation, seed.content.edition, seed.content.amendment].map(s => s.trim().toLowerCase()).join("|") } });
    const revision = existing ? await getCurrent("reference", existing.id, db) : await saveContent({ kind: "reference", entityId: null, expectedRevisionId: null, operationId: randomUUID(), content: seed.content }, db) as Revision<"reference">;
    sourceMap.set(seed.key, revision!);
  }
  const requirements: Revision<"requirement">[] = [];
  for (let index = 0; index < candidateSeeds.length; index++) {
    const seed = candidateSeeds[index];
    // Stable operation identifiers make rerunning seeding safe even after an engineer edits a seeded entry.
    const operationId = "c097de00-0000-4000-8000-" + String(index + 1).padStart(12, "0");
    const existing = await db.standardAuditEvent.findUnique({ where: { operationId } });
    if (existing) {
      const original = JSON.parse(existing.resultJson) as Revision<"requirement">;
      requirements.push((await getCurrent("requirement", original.entityId, db))!);
    } else {
      requirements.push(await saveContent({ kind: "requirement", entityId: null, expectedRevisionId: null, operationId, content: { ...seed.content, sourceRevisionId: sourceMap.get(seed.sourceKey)!.id } }, db) as Revision<"requirement">);
    }
  }
  const operationId = "c097de00-0000-4000-8000-000000000100";
  if (!await db.standardAuditEvent.findUnique({ where: { operationId } })) {
    await saveContent({ kind: "profile", entityId: null, expectedRevisionId: null, operationId, content: {
      title: "EI Electrical Documentation — Candidate Baseline", purpose: "Identify and review documentation requirements before implementing IEC schematic views.",
      scope: "Candidate electrical documentation topics. Full normative requirements and applicability have not been reviewed.",
      clientReference: "", projectReference: "", status: "active",
      entries: requirements.map(requirement => ({ requirementRevisionId: requirement.id, implementationRevisionId: null, applicability: "unresolved", rationale: "Authoritative source review is pending.", conflict: "" }))
    } }, db);
  }
  return { sources: sourceMap.size, topics: requirements.length };
}

