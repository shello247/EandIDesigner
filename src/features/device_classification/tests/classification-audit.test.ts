import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel } from "@/features/drawing_canvas/data/schema";
import { auditClassificationInventory, type ClassificationInventory } from "../logic/services/classification-audit";

function empty(): ClassificationInventory {
  return { symbols: [], versions: [], items: [], revisions: [], drawings: [], configurations: [], templates: [], attachments: [] };
}
describe("read-only closed classification census", () => {
  it("recognizes built-in root assets without exempting their missing nested products", () => {
    const data = empty(); const model = createDefaultDrawingModel();
    model.assets = [{ id: "panel", tag: "PDP-101", title: "Generated panel", type: "panel",
      symbolId: "__generated_panel_enclosure__", versionId: "generated_panel_enclosure_v1",
      componentSelections: [{ positionKey: "module", componentKey: "child", symbolId: "missing-symbol", versionId: "missing-version" }] }];
    data.drawings = [{ id: "d", title: "Generated references", modelJson: JSON.stringify(model) }];
    const before = JSON.stringify(data);
    const report = auditClassificationInventory(data);
    expect(report.records.find(r => r.kind === "asset")?.issues).toEqual([]);
    expect(report.records.find(r => r.kind === "physical_product" && r.label === "PDP-101")?.issues).toEqual([]);
    expect(report.records.find(r => r.kind === "physical_product" && r.label.includes("module"))?.issues).toContain("Missing or wrong-owner pinned Symbol version.");
    expect(JSON.stringify(data)).toBe(before);
  });
  it("keeps malformed records in totals and continues other packages", () => {
    const data = empty();
    data.drawings = [{ id: "bad", title: "Unreadable", modelJson: "{broken" },
      { id: "good", title: "Valid", modelJson: JSON.stringify(createDefaultDrawingModel()) }];
    const before = structuredClone(data);
    const report = auditClassificationInventory(data);
    expect(report.counts.drawing).toBe(2);
    expect(report.records.find(r => r.id === "bad")?.issues[0]).toContain("nested census incomplete");
    expect(report.records.find(r => r.id === "good")?.integrity).toBe("passed");
    expect(report.records.find(r => r.id === "good")?.outcome).toBe("needs_evidence");
    expect(data).toEqual(before);
  });
  it("counts physical products separately from repeated and unplaced occurrences", () => {
    const data = empty(); const model = createDefaultDrawingModel();
    model.assets = [{ id: "one", tag: "EQ-101", title: "Rack", type: "chassis_rack" },
      { id: "two", tag: "UPS-101", title: "Unplaced", type: "ups" }];
    data.drawings = [{ id: "drawing", title: "Package", modelJson: JSON.stringify(model) }];
    const report = auditClassificationInventory(data);
    expect(report.counts.asset).toBe(2); expect(report.counts.physical_product).toBe(2);
    expect(report.counts.occurrence ?? 0).toBe(0);
    expect(report.records.filter(r => r.kind === "asset").every(r => r.outcome === "needs_evidence")).toBe(true);
  });
  it("accounts for malformed versions, missing parents and unavailable evidence individually", () => {
    const data = empty();
    data.symbols.push({ id: "s", displayName: "Symbol" });
    data.versions.push({ id: "v", symbolId: "s", versionNumber: 1, deviceType: null, metadataJson: "{}", hasSvg: true },
      { id: "orphan", symbolId: "missing", versionNumber: 1, deviceType: "garbage", metadataJson: "!", hasSvg: false });
    data.attachments.push({ kind: "item_document", id: "pdf", ownerId: "missing", contentPresent: 0 });
    const report = auditClassificationInventory(data);
    expect(report.counts.symbol_version).toBe(2);
    expect(report.records.find(r => r.id === "orphan")?.issues).toContain("Missing parent Symbol.");
    expect(report.records.find(r => r.id === "pdf")?.issues).toEqual(["Attachment content unavailable.", "Missing attachment owner."]);
    expect(report.records.every(r => r.outcome !== "historical_integrity_checked")).toBe(true);
  });
});
