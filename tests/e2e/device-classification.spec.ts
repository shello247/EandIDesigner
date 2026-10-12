import { randomUUID } from "node:crypto";
import { expect, test } from "./drawing-test";
import { prisma } from "../../src/lib/prisma";
import { createDefaultDrawingModel, parseDrawingModelJson, stringifyDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import { stringifyMetadata } from "../../src/features/symbol_registry/data/schema";
import { assertAuditDatabase } from "../../scripts/drawing-performance-audit/run-config.mjs";
assertAuditDatabase();

async function fixture() {
  const key = `classification_${randomUUID()}`;
  const category = await prisma.symbolCategory.findUniqueOrThrow({ where: { normalizedName: "other" } });
  const symbol = await prisma.symbol.create({ data: { symbolKey: key, displayName: key, category: "other", categoryId: category.id, status: "approved",
    versions: { create: { versionNumber: 1, status: "approved", deviceType: "ups",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><rect x="1" y="1" width="28" height="38"/></svg>',
      metadataJson: stringifyMetadata({ symbolKey: key, displayName: key, category: "other", layoutUsage: "both",
        viewBox: { x: 0, y: 0, width: 30, height: 40 }, physicalWidthMm: 30, physicalHeightMm: 40,
        panelWiring: { assetType: "power_supply", tagPrefix: "UPS" }, terminals: [], anchors: [] }) } } }, include: { versions: true } });
  const version = symbol.versions[0]; const model = createDefaultDrawingModel();
  model.assets = [{ id: "unit", tag: "UPS-101", title: "Synthetic supply", type: "other", symbolId: symbol.id, versionId: version.id },
    { id: "rack", tag: "EQ-101", title: "Synthetic passive chassis", type: "chassis_rack" },
    { id: "panel", tag: "PDP-101", title: "Synthetic generated panel", type: "panel",
      symbolId: "__generated_panel_enclosure__", versionId: "generated_panel_enclosure_v1",
      metadata: { generatedKind: "power_distribution_panel" } },
    { id: "strip", tag: "TB-101", title: "Synthetic generated terminal block", type: "terminal_block",
      symbolId: "__generated_terminal_block__", versionId: "generated_terminal_block_v1" }];
  const drawing = await prisma.drawing.create({ data: { drawingKey: key, title: key, status: "draft", modelJson: stringifyDrawingModel(model) } });
  return { symbol, version, drawing, cleanup: async () => {
    await prisma.drawing.delete({ where: { id: drawing.id } }); await prisma.symbol.delete({ where: { id: symbol.id } });
  } };
}

test("explicit classification correction retains historical content and requires evidence", async ({ page }, info) => {
  const data = await fixture();
  try {
    await page.goto(`/symbols/${data.symbol.id}`);
    await page.getByRole("button", { name: "Review classification", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Review classification", exact: true });
    await dialog.getByRole("combobox", { name: "Device Type", exact: true }).selectOption("chassis_rack");
    await dialog.getByRole("button", { name: "Save classification" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Record the manufacturer");
    await dialog.getByLabel("Evidence and applicability").fill("Synthetic qualification fixture only; no real manufacturer claim.");
    await dialog.getByRole("button", { name: "Save classification" }).click();
    await expect(dialog.getByRole("status")).toContainText("Classification saved as");
    const receiptLink = dialog.getByRole("link", { name: "Download receipt" });
    const receipt = await receiptLink.evaluate(async link => (await fetch((link as HTMLAnchorElement).href)).json());
    expect(receipt).toHaveProperty("after", "chassis_rack");
    const [download] = await Promise.all([page.waitForEvent("download"), receiptLink.click()]);
    await download.saveAs(info.outputPath("classification-receipt.json"));
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const after = await prisma.symbolVersion.findUniqueOrThrow({ where: { id: data.version.id } });
    expect(after).toEqual({ ...data.version, deviceType: "chassis_rack" });
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawing.id } })).modelJson).toBe(data.drawing.modelJson);
    await page.reload(); await expect(page.getByText("Chassis / Rack", { exact: true }).first()).toBeVisible();
    await page.goto("/symbols?deviceType=chassis_rack");
    await expect(page.getByRole("link", { name: data.symbol.displayName, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Manage categories|New category/i })).toHaveCount(0);
  } finally { await data.cleanup(); }
});

test("asset reconciliation is explicit, local, undoable and classification-only", async ({ page }, info) => {
  test.setTimeout(90000); const data = await fixture();
  try {
    await page.goto(`/drawings/${data.drawing.id}`);
    await page.getByRole("button", { name: "Asset Manager", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Asset Manager", exact: true });
    await expect(dialog.getByRole("button", { name: "UPS, 1 asset", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Chassis / Rack, 1 asset", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Panel, 1 asset", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Terminal Block, 1 asset", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Panel, 1 asset", exact: true }).click();
    await dialog.getByRole("button", { name: /PDP-101 Synthetic generated panel/ }).click();
    await dialog.getByRole("button", { name: /1 Identity/ }).click();
    await expect(dialog.getByText("From this application-generated asset", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Review classification", exact: true }).click();
    await expect(dialog.getByRole("link", { name: "Open Symbol classification", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "UPS, 1 asset", exact: true }).click();
    await dialog.getByRole("button", { name: /UPS-101 Synthetic supply/ }).click();
    await dialog.getByRole("button", { name: /1 Identity/ }).click();
    await dialog.getByRole("button", { name: "Review classification", exact: true }).click();
    await expect(dialog.getByText("Saved drawing type: Other", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("classification-review.png") });
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawing.id } })).modelJson).toBe(data.drawing.modelJson);
    await dialog.getByRole("button", { name: "Apply to drawing draft" }).click();
    await dialog.press("Escape"); await expect(dialog).toHaveCount(0);
    await page.getByTestId("drawing-canvas-viewport").focus(); await page.keyboard.press("Control+z");
    await page.getByRole("button", { name: "Asset Manager", exact: true }).click();
    await dialog.getByRole("button", { name: "UPS, 1 asset", exact: true }).click();
    await dialog.getByRole("button", { name: /UPS-101 Synthetic supply/ }).click();
    await dialog.getByRole("button", { name: /1 Identity/ }).click();
    await dialog.getByRole("button", { name: "Review classification", exact: true }).click();
    await expect(dialog.getByText("Saved drawing type: Other", { exact: true })).toBeVisible();
    await dialog.press("Escape"); await page.getByTestId("drawing-canvas-viewport").focus(); await page.keyboard.press("Control+y");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
    const saved = parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawing.id } })).modelJson);
    const before = parseDrawingModelJson(data.drawing.modelJson);
    expect(saved).toEqual({ ...before, assets: before.assets.map(asset => asset.id === "unit" ? { ...asset, type: "ups" } : asset) });
    await page.reload();
  } finally { await data.cleanup(); }
});

test("saved-record audit is read-only and includes unplaced equipment", async ({ request }) => {
  const data = await fixture();
  try {
    const source = await prisma.symbolSourceAsset.create({ data: { symbolId: data.symbol.id,
      versionId: data.version.id, fileName: "synthetic.svg", mimeType: "image/svg+xml",
      sizeBytes: 5, dataUrl: "data:image/svg+xml;base64,PHN2Zy8+" } });
    const missingSource = await prisma.symbolSourceAsset.create({ data: { symbolId: data.symbol.id,
      fileName: "missing.pdf", mimeType: "application/pdf", sizeBytes: 0, dataUrl: null } });
    const response = await request.get("/api/device-classification/audit");
    expect(response.ok()).toBe(true); const report = await response.json();
    expect(report.records.filter((r: { kind: string; parentId?: string }) => r.kind === "asset" && r.parentId === data.drawing.id)).toHaveLength(4);
    expect(report.records.find((r: { kind: string; id: string; parentId?: string }) => r.kind === "asset" && r.id === "panel" && r.parentId === data.drawing.id).issues).toEqual([]);
    expect(report.records.find((r: { id: string }) => r.id === data.drawing.id).outcome).toBe("needs_evidence");
    expect(report.inventory.attachments.find((r: { id: string }) => r.id === source.id)).toMatchObject({ sizeBytes: 5, contentPresent: 1 });
    expect(report.inventory.attachments.find((r: { id: string }) => r.id === missingSource.id)).toMatchObject({ sizeBytes: 0, contentPresent: 0 });
    expect(report.records.find((r: { id: string }) => r.id === missingSource.id).issues).toContain("Attachment content unavailable.");
    expect(await prisma.symbolSourceAsset.findUniqueOrThrow({ where: { id: source.id } })).toEqual(source);
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawing.id } })).modelJson).toBe(data.drawing.modelJson);
  } finally { await data.cleanup(); }
});
