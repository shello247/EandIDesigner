import { expect, test, type Page, type Locator } from "./drawing-test";
import { createE2eNmt81ToNrf81Drawing, createE2eTerminalBlockGroupPackage, deleteE2eDrawing, deleteE2eSymbol } from "./drawing-fixtures";
import { confirmCanvasPlacement } from "./drawing-placement-helpers";
import { prisma } from "../../src/lib/prisma";
import { createDefaultDrawingModel, parseDrawingModelJson, stringifyDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import { resolveAuditConfiguration, assertAuditDatabase } from "../../scripts/drawing-performance-audit/run-config.mjs";

assertAuditDatabase(resolveAuditConfiguration());

const consoleErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
});
test.afterEach(async ({ page }) => { expect(consoleErrors.get(page)).toEqual([]); });

/** Compare geometry, not differently sized ghost/selection painted strokes. */
async function svgGeometryBox(locator: Locator) {
  return locator.evaluate(element => {
    const svg = element as SVGGraphicsElement;
    const bounds = svg.getBBox(), matrix = svg.getScreenCTM()!;
    const corners = [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y],
      [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
    const x = Math.min(...corners.map(p => p.x)), y = Math.min(...corners.map(p => p.y));
    return { x, y, width: Math.max(...corners.map(p => p.x)) - x, height: Math.max(...corners.map(p => p.y)) - y };
  });
}

async function fixture(page: Page, denseCount = 0) {
  const id = await createE2eNmt81ToNrf81Drawing();
  const model = createDefaultDrawingModel();
  if (denseCount) {
    const original = await saveModel(id);
    const cable = original.sheets[0].placements.find(placement => placement.role === "cable_assembly")!;
    model.sheets[0].placements = Array.from({ length: denseCount }, (_, index) => ({
      ...cable, id: `dense-${index}`, assetId: `dense-asset-${index}`, tag: `C-${1000 + index}`,
      x: 20 + index % 20 * 18, y: 20 + Math.floor(index / 20) * 15, scale: .06
    }));
  }
  model.assets = [
    { id: "reserved-101", type: "other", title: "Reserved one", tag: "C-101" },
    { id: "reserved-103", type: "other", title: "Reserved three", tag: "C-103" }
  ];
  await prisma.drawing.update({ where: { id }, data: { modelJson: stringifyDrawingModel(model) } });
  await page.goto("/drawings/" + id);
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  return id;
}
async function chooseCable(page: Page) {
  const expand = page.getByRole("button", { name: "Expand Symbol Library" });
  if (await expand.count()) await expand.click();
  const category = page.getByRole("button", { name: /^Cable / });
  if (await category.getAttribute("aria-expanded") !== "true") await category.click();
  await page.getByRole("button", { name: "CLX Cable 1 Pair", exact: true }).click();
  await page.getByRole("button", { name: "Continue to placement", exact: true }).click();
  await expect(page.getByTestId("placement-session")).toBeVisible();
}
function placements(page: Page) {
  return page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id]');
}
async function save(page: Page, id: string) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
  await expect.poll(async () => (await prisma.drawing.findUniqueOrThrow({ where: { id } })).modelJson).not.toBe("");
  return parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id } })).modelJson);
}

test("Ctrl-click repeats with gap reuse; releasing Ctrl finishes with independent undo/redo", async ({ page }) => {
  const id = await fixture(page);
  await chooseCable(page);
  await expect(page.getByTestId("placement-tag")).toHaveText("C-102");
  await expect(placements(page)).toHaveCount(0);
  await confirmCanvasPlacement(page, { x: 130, y: 100 }, false, true);
  await expect(placements(page)).toHaveCount(1);
  await expect(page.getByTestId("placement-tag")).toHaveText("C-104");
  await confirmCanvasPlacement(page, { x: 215, y: 140 }, false, true);
  await expect(page.getByTestId("placement-tag")).toHaveText("C-105");
  await confirmCanvasPlacement(page, { x: 300, y: 180 }, false);
  await expect(page.getByTestId("placement-session")).toHaveCount(0);
  await expect(placements(page)).toHaveCount(3);
  await page.keyboard.press("Control+z");
  await expect(placements(page)).toHaveCount(2);
  await page.keyboard.press("Control+y");
  await expect(placements(page)).toHaveCount(3);
  await save(page, id);
  await expect.poll(async () => (await saveModel(id)).sheets[0].placements.length).toBe(3);
  const model = await saveModel(id);
  expect(model.sheets[0].placements.map(p => p.tag)).toEqual(["C-102", "C-104", "C-105"]);
  expect(new Set(model.sheets[0].placements.map(p => p.assetId)).size).toBe(3);
  await page.reload();
  await expect(placements(page)).toHaveCount(3);
});
async function saveModel(id: string) {
  return parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id } })).modelJson);
}
test("cancelled, invalid and double-click attempts cannot create phantom copies", async ({ page }) => {
  await fixture(page);
  await chooseCable(page);
  await page.keyboard.press("Escape");
  await expect(placements(page)).toHaveCount(0);
  await chooseCable(page);
  const paper = await page.locator('[data-sheet-paper="true"]').boundingBox();
  if (!paper) throw new Error("Missing paper");
  await page.mouse.move(paper.x + 2, paper.y + 2);
  await expect(page.getByTestId("placement-ghost")).toHaveAttribute("data-valid", "false");
  await page.mouse.click(paper.x + 2, paper.y + 2);
  await expect(placements(page)).toHaveCount(0);
  await expect(page.getByTestId("placement-tag")).toHaveText("C-102");
  const x = paper.x + paper.width / 2, y = paper.y + paper.height / 2;
  await page.mouse.move(x, y);
  await expect(page.getByTestId("placement-ghost")).toHaveAttribute("data-valid", "true");
  await page.keyboard.down("Control");
  await page.mouse.dblclick(x, y);
  await page.keyboard.up("Control");
  await expect(placements(page)).toHaveCount(1);
  await expect(page.getByTestId("placement-tag")).toHaveText("C-104");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("placement-session")).toHaveCount(0);
  await chooseCable(page);
  await expect(page.getByTestId("placement-tag")).toHaveText("C-104");
  await page.keyboard.press("Escape");
});
test("instructions replace the old controls and ordinary clicks place once", async ({ page }, testInfo) => {
  await fixture(page);
  await chooseCable(page);
  const instructions = page.getByTestId("placement-instructions");
  await expect(instructions).toContainText("Place once");
  await expect(instructions).toContainText("Ctrl + click");
  await expect(instructions).toContainText("Esc");
  await expect(instructions.getByRole("checkbox")).toHaveCount(0);
  await expect(instructions.getByRole("combobox")).toHaveCount(0);
  await expect(instructions.getByRole("button", { name: "Finish", exact: true })).toHaveCount(0);
  await instructions.screenshot({ path: testInfo.outputPath("placement-instructions.png") });
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(instructions).toBeVisible();
  expect(await instructions.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const paper = (await page.locator('[data-sheet-paper="true"]').boundingBox())!;
  const centre = { x: paper.x + paper.width / 2, y: paper.y + paper.height / 2 };
  expect(await page.evaluate(point => Boolean(document.elementFromPoint(point.x, point.y)?.closest('[data-sheet-paper="true"]')), centre)).toBe(true);
  await page.mouse.move(centre.x, centre.y);
  await page.getByTestId("drawing-canvas-viewport").screenshot({ path: testInfo.outputPath("placement-canvas.png") });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByRole("button", { name: "Rotate placement" }).click();
  await expect(placements(page)).toHaveCount(0);
  await confirmCanvasPlacement(page);
  await expect(placements(page)).toHaveCount(1);
  await expect(page.getByTestId("placement-session")).toHaveCount(0);
});
test("dense-canvas pointer previews make no server requests or full-model work", async ({ page }) => {
  await page.addInitScript(() => { globalThis.__EI_DRAWING_PERFORMANCE_ENABLED__ = true; });
  await fixture(page, 250);
  await page.getByRole("button", { name: "Add to drawing" }).click();
  await page.getByRole("menuitem", { name: /Note/ }).click();
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  const paper = await page.locator('[data-sheet-paper="true"]').boundingBox();
  if (!paper) throw new Error("Missing paper");
  await page.mouse.move(paper.x + paper.width * .4, paper.y + paper.height * .4, { steps: 50 });
  await expect(page.getByTestId("placement-ghost")).toHaveAttribute("data-valid", "true");
  await page.evaluate(() => { globalThis.__EI_DRAWING_PERFORMANCE_COUNTS__ = {}; });
  await page.mouse.move(paper.x + paper.width * .6, paper.y + paper.height * .6, { steps: 50 });
  expect(await page.evaluate(() => globalThis.__EI_DRAWING_PERFORMANCE_COUNTS__)).toEqual({});
  expect(requests).toEqual([]);
  await confirmCanvasPlacement(page);
  await expect(page.getByTestId("placement-session")).toHaveCount(0);
});

test("preview equals committed geometry at 20, 100, 206 and 800 percent, including stationary scrolling", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await fixture(page);
  await chooseCable(page);
  const viewport = page.getByTestId("drawing-canvas-viewport");
  const paper = page.locator('[data-sheet-paper="true"]');
  const zoom = page.getByTestId("drawing-zoom-display");
  const ghostBounds = page.getByTestId("placement-ghost").locator(":scope > g > rect:last-child");
  for (const percent of [20, 100, 206, 800]) {
    const current = Number((await zoom.textContent())!.replace("%", "")) / 100;
    const viewportBox = (await viewport.boundingBox())!;
    const beforePaper = (await paper.boundingBox())!;
    let x = (Math.max(viewportBox.x, beforePaper.x) + Math.min(viewportBox.x + viewportBox.width, beforePaper.x + beforePaper.width)) / 2;
    let y = (Math.max(viewportBox.y, beforePaper.y) + Math.min(viewportBox.y + viewportBox.height, beforePaper.y + beforePaper.height)) / 2;
    await page.mouse.move(x, y);
    await viewport.dispatchEvent("wheel", { ctrlKey: true, cancelable: true, bubbles: true,
      clientX: x, clientY: y, deltaMode: 0, deltaY: -Math.log(percent / 100 / current) / .0015 });
    await expect(zoom).toHaveText(`${percent}%`);
    // At the zoom-out limit scroll clamping can move the paper away from the
    // pointer. Return to its visible body; hiding outside the paper is correct.
    const afterPaper = (await paper.boundingBox())!;
    x = (Math.max(viewportBox.x, afterPaper.x) + Math.min(viewportBox.x + viewportBox.width, afterPaper.x + afterPaper.width)) / 2;
    y = (Math.max(viewportBox.y, afterPaper.y) + Math.min(viewportBox.y + viewportBox.height, afterPaper.y + afterPaper.height)) / 2;
    await page.mouse.move(x, y);
    await page.keyboard.press("r");
    await expect(page.getByTestId("placement-ghost")).toHaveAttribute("data-valid", "true");
    if (percent === 800) {
      const before = await svgGeometryBox(ghostBounds);
      await viewport.evaluate(element => element.scrollBy(17, 23));
      await expect.poll(async () => {
        const after = await svgGeometryBox(ghostBounds);
        return Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
      }).toBeLessThan(1);
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(x - 35, y - 25);
      await page.mouse.up({ button: "middle" });
      await page.mouse.move(x, y);
      await expect(page.getByTestId("placement-ghost")).toHaveAttribute("data-valid", "true");
    }
    const preview = await svgGeometryBox(ghostBounds);
    const count = await placements(page).count();
    await page.keyboard.down("Control");
    await page.mouse.click(x, y);
    await page.keyboard.up("Control");
    await expect(placements(page)).toHaveCount(count + 1);
    const committed = await svgGeometryBox(placements(page).last());
    for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(committed[key] - preview[key]), `${percent}% ${key}: ${JSON.stringify({ preview, committed })}`).toBeLessThan(1);
  }
  await page.keyboard.press("Escape");
});

test("full-span ducts and dimension lines retain physical sizing without creating assets", async ({ page }) => {
  const fixture = await createE2eTerminalBlockGroupPackage();
  try {
  const original = await saveModel(fixture.drawingId);
  await page.goto(`/drawings/${fixture.drawingId}`);
  await page.getByRole("button", { name: "Expand Symbol Library" }).click();
  await page.getByRole("button", { name: /^Panel Layout/ }).click();
  for (const rotate of [false, true]) {
    await page.getByRole("button", { name: "Wire Tray / Duct", exact: true }).click();
    if (rotate) await page.keyboard.press("r");
    await confirmCanvasPlacement(page);
  }
  for (const name of ["Horizontal Dimension", "Vertical Dimension"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await confirmCanvasPlacement(page);
  }
  const saved = await save(page, fixture.drawingId);
  const inserted = saved.sheets[0].placements.filter(p => !original.sheets[0].placements.some(previous => previous.id === p.id));
  const ducts = inserted.filter(p => !p.layoutDimension);
  expect(ducts).toHaveLength(2);
  expect(ducts.map(p => p.rotation)).toEqual([0, 90]);
  expect(ducts.map(p => p.layoutDimensions?.lengthMm)).toEqual([294, 194]);
  expect(ducts[0].layoutDimensions?.widthMm).toBe(ducts[1].layoutDimensions?.widthMm);
  const dimensions = inserted.filter(p => p.layoutDimension).map(p => p.layoutDimension!);
  expect(dimensions.map(d => d.endMm - d.startMm)).toEqual([294, 194]);
  expect(saved.assets).toEqual(original.assets);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
    await deleteE2eSymbol(fixture.endBracketSymbolId);
  }
});
test("canvas Ctrl-wheel stays local during placement", async ({ page }) => {
  await fixture(page);
  await chooseCable(page);
  const viewport = page.getByTestId("drawing-canvas-viewport");
  const paper = page.locator('[data-sheet-paper="true"]');
  const before = await paper.boundingBox();
  const headerBefore = await page.getByRole("button", { name: "Drawing saved", exact: true }).boundingBox();
  if (!before || !headerBefore) throw new Error("Missing geometry");
  await page.mouse.move(before.x + before.width * .5, before.y + before.height * .5);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect.poll(async () => (await paper.boundingBox())!.width).toBeGreaterThan(before.width);
  const headerAfter = await page.getByRole("button", { name: "Drawing saved", exact: true }).boundingBox();
  expect(headerAfter!.width).toBeCloseTo(headerBefore.width, 1);
  await expect(viewport).toBeVisible();
  await expect(page.getByTestId("placement-session")).toBeVisible();
  await expect(placements(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
});
