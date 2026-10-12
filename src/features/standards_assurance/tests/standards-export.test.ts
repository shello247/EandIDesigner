import { getStandardsContext } from "../data/context";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./test-database";
import { seedStandards } from "../data/seeds";
import { listContent, getSnapshot } from "../data/queries";
import { createReportSnapshot } from "../data/assurance-mutations";
import { snapshotHtml, snapshotJson } from "../logic/services/standards-export";
import { contentHash } from "../logic/services/standards-hash";

describe("frozen dossier exports", () => {
  it("preserves manifest identity, candidate gaps, exclusions and safe long text", async () => {
    const db = await testDatabase();
    try {
      await seedStandards(db);
      const profile = (await listContent({ kind: "profile" }, db)).rows[0];
      const result = await createReportSnapshot({ operationId: randomUUID(), profileRevisionId: profile.revisionId, expectedCurrentRevisionId: profile.revisionId, expectedAssessmentHash: (await getStandardsContext(profile.revisionId, db, "test-build")).assessmentHash }, db, "test-build");
      const snapshot = await getSnapshot(result.id, db);
      snapshot.context.profile.content.title = '<script>alert("x")</script>';
      snapshot.context.rows[0].entry.applicability = "excluded";
      snapshot.context.rows[0].entry.rationale = "Excluded because " + "long explanation ".repeat(200);
      const html = snapshotHtml(snapshot), json = JSON.parse(snapshotJson(snapshot));
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain(snapshot.id);
      expect(html).toContain(snapshot.localReviewNotice);
      expect(html).toContain(snapshot.provenanceNotice);
      expect(html).toContain('authoritative source review is pending');
      expect(html).toContain(snapshot.context.rows[0].entry.rationale);
      expect(html).toContain('@media print');
      expect(json.snapshot).toEqual(snapshot);
      expect(json.manifest.contentDigest).toBe(contentHash(snapshot));
      expect(html).toContain(json.manifest.contentDigest);
      expect(snapshotJson(snapshot)).toBe(snapshotJson(snapshot));
      expect(snapshotHtml(snapshot)).toBe(html);
    } finally { await db.$disconnect(); }
  });
});
