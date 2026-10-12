import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveContentSchema, type ContentByKind, type EntityKind } from "./schema";
import { getCurrent, getRevision, tables, type Db } from "./queries";
import { StandardsError } from "../logic/services/standards-errors";
import { contentHash, stableJson } from "../logic/services/standards-hash";
import type { Revision } from "../types";

export async function operation<T>(operationId: string, request: unknown, kind: string, run: (tx: Db) => Promise<T>, db: PrismaClient = prisma): Promise<T> {
  const requestHash = contentHash(request);
  try {
    return await db.$transaction(async tx => {
      const replay = await tx.standardAuditEvent.findUnique({ where: { operationId } });
      if (replay) {
        if (replay.requestHash !== requestHash || replay.kind !== kind) throw new StandardsError("operation_conflict", "This operation identifier was already used for different content.");
        return JSON.parse(replay.resultJson) as T;
      }
      const result = await run(tx);
      const targetId = result && typeof result === "object" && "id" in result ? String(result.id) : kind;
      await tx.standardAuditEvent.create({ data: { id: randomUUID(), operationId, requestHash, kind, targetId, resultJson: stableJson(result) } });
      return result;
    }, { timeout: 20000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P1008", "P2028"].includes(error.code)) {
      const replay = await db.standardAuditEvent.findUnique({ where: { operationId } });
      if (replay && replay.requestHash === requestHash && replay.kind === kind) return JSON.parse(replay.resultJson) as T;
      throw new StandardsError("conflict", "The record changed or this identity already exists. Reload and review before saving.");
    }
    throw error;
  }
}
const referenceKey = (content: ContentByKind["reference"]) => [content.publisher, content.designation, content.edition, content.amendment].map(s => s.normalize("NFKC").trim().toLowerCase()).join("|");
async function validateReferences(kind: EntityKind, content: ContentByKind[EntityKind], tx: Db) {
  if (kind === "requirement") {
    const data = content as ContentByKind["requirement"], source = await getRevision("reference", data.sourceRevisionId, tx);
    if (data.sourceStatus === "source_checked" && source.content.access !== "full_source") throw new StandardsError("source_unverified", "Catalogue information cannot support a source-checked requirement. Record the authoritative material examined first.");
  }
  if (kind === "implementation") await getRevision("requirement", (content as ContentByKind["implementation"]).requirementRevisionId, tx);
  if (kind === "profile") {
    const data = content as ContentByKind["profile"];
    const revisions = await Promise.all(data.entries.map(entry => getRevision("requirement", entry.requirementRevisionId, tx)));
    if (new Set(revisions.map(revision => revision.entityId)).size !== revisions.length) throw new StandardsError("inconsistent_reference", "Choose only one revision of each requirement.");
    for (const entry of data.entries) {
      if (entry.implementationRevisionId) {
        const implementation = await getRevision("implementation", entry.implementationRevisionId, tx);
        if (implementation.content.requirementRevisionId !== entry.requirementRevisionId) throw new StandardsError("inconsistent_reference", "The implementation belongs to another requirement revision.");
      }
    }
  }
}
export async function saveContent(input: unknown, db: PrismaClient = prisma): Promise<Revision> {
  const parsed = saveContentSchema.parse(input);
  return operation(parsed.operationId, parsed, "save_" + parsed.kind, async tx => {
    const { kind, content } = parsed, table = tables[kind];
    const previous = parsed.entityId ? await getCurrent(kind, parsed.entityId, tx) : null;
    if (parsed.entityId && !previous) throw new StandardsError("not_found", "The record no longer exists.");
    if ((previous?.id ?? null) !== parsed.expectedRevisionId) throw new StandardsError("conflict", "This record has a newer revision. Your draft has been retained; reload and compare.", previous?.id);
    await validateReferences(kind, content, tx);
    if (kind === "reference" && previous && referenceKey(previous.content as ContentByKind["reference"]) !== referenceKey(content as ContentByKind["reference"])) throw new StandardsError("validation", "Create a new standard entry for a different publisher, designation, edition or amendment.");
    const hash = contentHash(content);
    if (previous?.hash === hash) return previous;
    const entityId = previous?.entityId ?? randomUUID(), revisionId = randomUUID(), version = (previous?.number ?? 0) + 1;
    const key = kind === "reference" ? referenceKey(content as ContentByKind["reference"]) : kind.toUpperCase().slice(0, 3) + "-" + entityId.slice(0, 8);
    const now = new Date();
    if (previous) {
      const changed = await tx.$executeRawUnsafe('UPDATE "' + table + '" SET title=?, status=?, currentRevisionNumber=?, updatedAt=? WHERE id=? AND currentRevisionNumber=?', content.title, content.status, version, now, entityId, previous.number);
      if (changed !== 1) throw new StandardsError("conflict", "The record changed while saving.");
    } else {
      await tx.$executeRawUnsafe('INSERT INTO "' + table + '" (id,key,title,status,currentRevisionNumber,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)', entityId, key, content.title, content.status, version, now, now);
    }
    const extra = kind === "requirement" ? { column: "sourceRevisionId", value: (content as ContentByKind["requirement"]).sourceRevisionId } : kind === "implementation" ? { column: "requirementRevisionId", value: (content as ContentByKind["implementation"]).requirementRevisionId } : null;
    await tx.$executeRawUnsafe('INSERT INTO "' + table + 'Revision" (id,entityId,revisionNumber,payloadJson,contentHash,createdAt' + (extra ? "," + extra.column : "") + ") VALUES (?,?,?,?,?,?" + (extra ? ",?" : "") + ")", revisionId, entityId, version, stableJson(content), hash, now, ...(extra ? [extra.value] : []));
    if (kind === "profile") {
      const entries = (content as ContentByKind["profile"]).entries;
      if (entries.length) await tx.standardProfileEntry.createMany({ data: entries.map(entry => ({ ...entry, profileRevisionId: revisionId })) });
    }
    return getRevision(kind, revisionId, tx);
  }, db);
}

