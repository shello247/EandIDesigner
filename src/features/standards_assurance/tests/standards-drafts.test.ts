import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./test-database";
import { seedStandards } from "../data/seeds";
import { saveContent } from "../data/mutations";
import { getCurrent, getRevision, listContent } from "../data/queries";
import { referenceSeeds, candidateSeeds } from "../data/standard-reference-seeds";
describe("standards draft services", () => {
  it("seeds repeatedly without replacing engineer content and lists bounded summaries", async () => {
    const db = await testDatabase();
    try {
      await seedStandards(db);
      const page = await listContent({ kind: "requirement" }, db);
      expect(page.total).toBe(6);
      const previous = await getRevision("requirement", page.rows[0].revisionId, db);
      const input = { kind: "requirement", entityId: previous.entityId, expectedRevisionId: previous.id, operationId: randomUUID(), content: { ...previous.content, owner: "Engineer" } };
      const updated = await saveContent(input, db);
      expect(updated.number).toBe(2);
      expect((await saveContent(input, db)).id).toBe(updated.id);
      await expect(saveContent({ ...input, content: { ...input.content, owner: "Different" } }, db)).rejects.toMatchObject({ code: "operation_conflict" });
      await expect(saveContent({ ...input, operationId: randomUUID() }, db)).rejects.toMatchObject({ code: "conflict" });
      await seedStandards(db);
      expect((await getCurrent("requirement", previous.entityId, db))?.content.owner).toBe("Engineer");
      expect(await db.standardReference.count()).toBe(5);
      expect(await db.standardRequirement.count()).toBe(6);
      expect(await db.standardProfile.count()).toBe(1);
      expect((await getRevision("requirement", previous.id, db)).content.owner).toBe("");
    } finally { await db.$disconnect(); }
  });
  it("rolls back failed source verification without an entity or audit event", async () => {
    const db = await testDatabase();
    try {
      const source = await saveContent({ kind: "reference", entityId: null, expectedRevisionId: null, operationId: randomUUID(), content: referenceSeeds[0].content }, db);
      const before = await db.standardAuditEvent.count();
      await expect(saveContent({ kind: "requirement", entityId: null, expectedRevisionId: null, operationId: randomUUID(), content: { ...candidateSeeds[0].content, sourceRevisionId: source.id, sourceStatus: "source_checked", locator: "1" } }, db)).rejects.toMatchObject({ code: "source_unverified" });
      expect(await db.standardRequirement.count()).toBe(0);
      expect(await db.standardAuditEvent.count()).toBe(before);
    } finally { await db.$disconnect(); }
  });
  it("rejects a profile that links an implementation to another requirement", async () => {
    const db = await testDatabase();
    try {
      await seedStandards(db);
      const rows = (await listContent({ kind: "requirement" }, db)).rows;
      const implementation = await saveContent({ kind: "implementation", entityId: null, expectedRevisionId: null, operationId: randomUUID(), content: { title: "Control", requirementRevisionId: rows[0].revisionId, implementationStatus: "planned", behavior: "Preserve identities", whereToSee: "", verificationPlan: "Compare terminal endpoints", limitations: "", controls: [], technicalReferences: [], status: "active" } }, db);
      await expect(saveContent({ kind: "profile", entityId: null, expectedRevisionId: null, operationId: randomUUID(), content: { title: "Invalid profile", purpose: "Test", scope: "Test", clientReference: "", projectReference: "", status: "active", entries: [{ requirementRevisionId: rows[1].revisionId, implementationRevisionId: implementation.id, applicability: "applies", rationale: "", conflict: "" }] } }, db)).rejects.toMatchObject({ code: "inconsistent_reference" });
      expect(await db.standardProfile.count()).toBe(1);
    } finally { await db.$disconnect(); }
  });
});
