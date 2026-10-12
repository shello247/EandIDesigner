import { test, expect, type Page } from "./drawing-test";
import { createE2eDinRailResizePackage, deleteE2eDrawing, deleteE2eSymbol } from "./drawing-fixtures";
import { prisma } from "../../src/lib/prisma";
import { parseDrawingModelJson, stringifyDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import { assertAuditDatabase, resolveAuditConfiguration } from "../../scripts/drawing-performance-audit/run-config.mjs";

assertAuditDatabase(resolveAuditConfiguration());
test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  page.on("dialog", dialog => dialog.accept());
});

async function fixture(page: Page, count = 7) {
  const result = await createE2eDinRailResizePackage();
  const version = await prisma.symbolVersion.findFirstOrThrow({ where: { symbolId: result.symbolId } });
  const metadata = JSON.parse(version.metadataJson);
  Object.assign(metadata, { symbolKey: "e2e_panel_label_device", displayName: "E2E PDB Device",
    panelCategory: "termination", resizable: false, physicalWidthMm: 20, physicalHeightMm: 50 });
  await prisma.symbol.update({ where: { id: result.symbolId }, data: { displayName: "E2E PDB Device", symbolKey: "label_" + result.symbolId } });
  await prisma.symbolVersion.update({ where: { id: version.id }, data: { metadataJson: JSON.stringify(metadata) } });
  const record = await prisma.drawing.findUniqueOrThrow({ where: { id: result.drawingId } });
  const model = parseDrawingModelJson(record.modelJson);
  const sheet = model.sheets[0];
  const source = sheet.placements.find(p => p.id === result.railId)!;
  const backplane = sheet.placements.find(p => p.layoutKind === "backplane")!;
  backplane.layoutScale = { mode: "manual", value: 2 };
  sheet.placements.find(p => p.enclosure)!.layoutScale = { mode: "manual", value: 2 };
  const devices = Array.from({ length: count }, (_, index) => ({
    ...source, role: "terminal_block" as const, id: "pdb_" + index, assetId: "label_asset_" + index, tag: "PDB-" + (101 + index),
    layoutPosition: count > 7 ? { xMm: 10 + (index % 10) * 26, yMm: 15 + Math.floor(index / 10) * 14 }
      : { xMm: 30 + (index % 5) * 24, yMm: index < 5 ? 85 : 150 },
    layoutDimensions: { lengthMm: index === 6 ? 80 : 20, widthMm: 50 },
    rotation: index === 5 ? 90 : 0,
    ...(index === 0 ? { labelPosition: { x: 5, y: -8 } } : {})
  }));
  sheet.placements = [...sheet.placements.filter(p => p.id !== source.id), ...devices];
  model.assets.push(...devices.map(p => ({
    id: p.assetId, tag: p.tag, title: "E2E PDB Device", type: "terminal_block" as const, symbolId: p.symbolId, versionId: p.versionId
  })));
  await prisma.drawing.update({ where: { id: result.drawingId }, data: { modelJson: stringifyDrawingModel(model) } });
  const before = await prisma.drawing.findUniqueOrThrow({ where: { id: result.drawingId } });
  await page.goto("/drawings/" + result.drawingId);
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  await page.getByRole("button", { name: "Fit drawing", exact: true }).click();
  return { ...result, before };
}
async function cleanup(data: Awaited<ReturnType<typeof fixture>>) {
  await deleteE2eDrawing(data.drawingId); await deleteE2eSymbol(data.symbolId);
}
const label = (page: Page, id = "pdb_0") => page.locator('.drawing-sheet-rendered [data-placement-tag="' + id + '"]');
async function selectDevice(page: Page, id = "pdb_0") {
  // Dense fixtures deliberately overlap bodies. Use the exposed top-left corner,
  // not the center covered by a later occurrence.
  await page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="' + id + '"]').click({ force: true, position: { x: 1, y: 1 } });
  const button = page.getByRole("button", { name: /Panel Layout E2E PDB Device/ });
  if (await button.getAttribute("aria-expanded") !== "true") await button.click();
  await expect(page.getByText("PDB-" + (101 + Number(id.replace("pdb_", ""))) + " · appearance only", { exact: true })).toBeVisible();
}
async function setZoom(page: Page, percent: number) {
  const viewport = page.getByTestId("drawing-canvas-viewport");
  const zoom = page.getByTestId("drawing-zoom-display");
  const current = Number((await zoom.textContent())!.replace("%", "")) / 100;
  const box = (await viewport.boundingBox())!;
  await viewport.dispatchEvent("wheel", { ctrlKey: true, cancelable: true, bubbles: true,
    clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
    deltaMode: 0, deltaY: -Math.log(percent / 100 / current) / .0015 });
  await expect(zoom).toHaveText(percent + "%");
}
async function snapshot(page: Page) {
  return label(page).evaluate(node => ({ x: Number(node.getAttribute("x")), y: Number(node.getAttribute("y")) }));
}
async function undo(page: Page, redo = false) {
  await page.getByTestId("drawing-canvas-viewport").focus();
  await page.keyboard.press(redo ? "Control+y" : "Control+z");
}

test("label handle uses the same normalized device footprint as committed artwork", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const data = await fixture(page);
  try {
    // pdb_6 intentionally carries obsolete 80mm width; pinned artwork is 20mm.
    await selectDevice(page, "pdb_6");
    const handle = page.getByTestId("canvas-placement-title-handle");
    const tag = label(page, "pdb_6");
    const anchorX = Number(await handle.getAttribute("cx")) + Number(await handle.getAttribute("r")) + .9;
    const anchorY = Number(await handle.getAttribute("cy")) + 1.25;
    expect(anchorX).toBeCloseTo(Number(await tag.getAttribute("x")), 2);
    expect(anchorY).toBeCloseTo(Number(await tag.getAttribute("y")), 2);
    await handle.scrollIntoViewIfNeeded();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const preview = page.getByTestId("panel-label-drag-preview").locator("text");
    await expect(preview).toHaveAttribute("x", (await tag.getAttribute("x"))!);
    await expect(preview).toHaveAttribute("y", (await tag.getAttribute("y"))!);
    await page.keyboard.press("Escape"); await page.mouse.up();
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).modelJson).toBe(data.before.modelJson);
  } finally { await cleanup(data); }
});

test("legacy labels, manual Properties controls, undo and save retain engineering data", async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const data = await fixture(page);
  try {
    await expect(page.locator('.drawing-sheet-rendered [data-placement-tag^="pdb_"]')).toHaveCount(7);
    for (const node of await page.locator('.drawing-sheet-rendered [data-placement-tag^="pdb_"]').all()) {
      await expect(node).toHaveAttribute("font-size", "2");
      await expect(node).toHaveAttribute("font-weight", "400");
    }
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).modelJson).toBe(data.before.modelJson);
    await selectDevice(page);
    const original = await snapshot(page);
    await page.getByLabel("Text size", { exact: true }).selectOption("large");
    await expect(label(page)).toHaveAttribute("font-size", "3");
    expect(await snapshot(page)).toEqual(original);
    await page.getByLabel("Orientation", { exact: true }).selectOption("270");
    await expect(label(page).locator("..")).toHaveAttribute("transform", new RegExp("^rotate\\(270 "));
    await page.getByRole("switch", { name: "Leader line" }).check();
    await page.getByLabel("Label X (mm)", { exact: true }).fill(String(original.x + 45));
    await page.getByLabel("Label X (mm)", { exact: true }).press("Enter");
    await expect(page.locator('.drawing-sheet-rendered [data-layout-label-leader-id="pdb_0"]')).toHaveCount(1);
    expect((await snapshot(page)).x).toBeCloseTo(original.x + 45, 1);
    await undo(page); expect(await snapshot(page)).toEqual(original);
    await undo(page, true);
    await page.getByRole("button", { name: "Reset position", exact: true }).click();
    await expect(page.getByLabel("Text size", { exact: true })).toHaveValue("large");
    await expect(page.getByLabel("Orientation", { exact: true })).toHaveValue("270");
    await expect(page.getByRole("switch", { name: "Leader line" })).toBeChecked();
    await page.getByLabel("Position", { exact: true }).selectOption("bottom-center");
    await page.getByLabel("Orientation", { exact: true }).selectOption("0");
    await page.screenshot({ path: info.outputPath("panel-label-properties.png") });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const saved = parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).modelJson);
    const before = parseDrawingModelJson(data.before.modelJson);
    expect(saved.assets).toEqual(before.assets);
    expect(saved.panelWiring).toEqual(before.panelWiring);
    expect(saved.sheets[0].connections).toEqual(before.sheets[0].connections);
    const stripped = (model: typeof saved) => model.sheets[0].placements.map(placement => {
      const device = { ...placement }; delete device.layoutLabel; delete device.labelPosition; return device;
    });
    expect(stripped(saved)).toEqual(stripped(before));
    expect(saved.sheets[0].placements.filter(p => p.id !== "pdb_0")).toEqual(before.sheets[0].placements.filter(p => p.id !== "pdb_0"));
    await page.reload(); await selectDevice(page);
    await expect(page.getByLabel("Text size", { exact: true })).toHaveValue("large");
    const printed = await page.request.get("/drawings/" + data.drawingId + "/print");
    expect(printed.ok()).toBe(true);
    const printHtml = await printed.text();
    expect(printHtml).toContain('font-size="2" font-weight="400" letter-spacing="0"');
    expect(printHtml).toContain('font-size="3" font-weight="400" letter-spacing="0"');
    const pdf = await page.request.get("/drawings/" + data.drawingId + "/pdf");
    expect(pdf.ok()).toBe(true);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
    const printedPage = await page.context().newPage();
    await printedPage.goto("/drawings/" + data.drawingId + "/print");
    await printedPage.screenshot({ path: info.outputPath("panel-label-print.png"), fullPage: true });
    await printedPage.close();
    await page.getByRole("combobox", { name: "Drawing view", exact: true }).selectOption("schematic");
    await expect(page.getByTestId("panel-layout-label-overlay")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await cleanup(data); }
});

test("dense canvas uses annotation-only preview; pointer cancellation and unit inputs are safe", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1700, height: 1100 });
  const data = await fixture(page, 100);
  try {
    await selectDevice(page);
    await page.getByLabel("Leader line", { exact: true }).check();
    await setZoom(page, 206);
    const handle = page.getByTestId("canvas-placement-title-handle");
    await handle.scrollIntoViewIfNeeded();
    // Observe the exact equipment tree; a temporary annotation portal is allowed,
    // replacing the drawing SVG or equipment nodes during pointer motion is not.
    await page.evaluate(() => {
      const paper = document.querySelector(".drawing-sheet-rendered")!;
      const equipment = Array.from(paper.querySelectorAll("[data-placement-id]"));
      (window as unknown as { labelEquipment: Element[] }).labelEquipment = equipment;
    });
    const original = await snapshot(page);
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 45, box.y + 30, { steps: 24 });
    await expect(page.getByTestId("panel-label-drag-preview")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { labelEquipment: Element[] }).labelEquipment.every(node =>
      node.isConnected && document.querySelector(".drawing-sheet-rendered")!.contains(node)
    ))).toBe(true);
    expect(await snapshot(page)).toEqual(original);
    await handle.dispatchEvent("pointercancel", { bubbles: true });
    await page.mouse.up();
    await expect(page.getByTestId("panel-label-drag-preview")).toHaveCount(0);
    expect(await snapshot(page)).toEqual(original);
    await page.getByRole("button", { name: "Drawing Settings", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Drawing Settings", exact: true });
    await dialog.getByRole("button", { name: "in", exact: true }).click();
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    const layout = page.getByRole("button", { name: /Panel Layout E2E PDB Device/ });
    await expect(layout).toBeVisible();
    if (await layout.getAttribute("aria-expanded") !== "true") await layout.click();
    await expect(page.getByText("PDB-101 · appearance only", { exact: true })).toBeVisible();
    await page.getByLabel("Label X (in)", { exact: true }).fill("4");
    await page.getByLabel("Label X (in)", { exact: true }).press("Enter");
    expect((await snapshot(page)).x).toBeCloseTo(101.6, 1);
    await page.getByLabel("Show label", { exact: true }).uncheck();
    await expect(label(page)).toHaveCount(0);
    await expect(page.locator('.drawing-sheet-rendered [data-layout-label-leader-id="pdb_0"]')).toHaveCount(0);
    await page.getByLabel("Show label", { exact: true }).check();
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.screenshot({ path: info.outputPath("panel-label-narrow-dense.png") });
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).modelJson).toBe(data.before.modelJson);
  } finally { await cleanup(data); }
});

test("label drag is transient, exact at every zoom, cancellable and one undo per gesture", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  const data = await fixture(page);
  try {
    await selectDevice(page);
    const requests: string[] = [];
    page.on("request", request => { if (request.method() !== "GET") requests.push(request.url()); });
    for (const zoom of [20, 100, 206, 800]) {
      await setZoom(page, zoom);
      const handle = page.getByTestId("canvas-placement-title-handle");
      await handle.scrollIntoViewIfNeeded();
      const initial = await snapshot(page);
      const box = (await handle.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 18, box.y + box.height / 2 + 12, { steps: 8 });
      const preview = page.getByTestId("panel-label-drag-preview").locator("text");
      await expect(preview).toBeVisible();
      expect(await snapshot(page)).toEqual(initial);
      await expect(label(page).locator("..")).toHaveCSS("visibility", "hidden");
      const point = await preview.evaluate(node => ({ x: Number(node.getAttribute("x")), y: Number(node.getAttribute("y")) }));
      await page.mouse.up();
      await expect(page.getByTestId("panel-label-drag-preview")).toHaveCount(0);
      const placed = await snapshot(page);
      expect(placed.x).toBeCloseTo(point.x, 1); expect(placed.y).toBeCloseTo(point.y, 1);
      await undo(page); expect(await snapshot(page)).toEqual(initial);
      await undo(page, true); expect(await snapshot(page)).toEqual(placed);
      await handle.scrollIntoViewIfNeeded();
      const cancelBox = (await handle.boundingBox())!;
      await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2);
      await page.mouse.down(); await page.mouse.move(cancelBox.x + 25, cancelBox.y + 18);
      await page.keyboard.press("Escape"); await page.mouse.up();
      expect(await snapshot(page)).toEqual(placed);
      await expect(label(page).locator("..")).not.toHaveCSS("visibility", "hidden");
      await undo(page); expect(await snapshot(page)).toEqual(initial);
    }
    expect(requests).toEqual([]);
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).modelJson).toBe(data.before.modelJson);
  } finally { await cleanup(data); }
});
