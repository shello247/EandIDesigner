import { expect, test, type Page } from "./drawing-test";
import { readFileSync } from "node:fs";
import { createE2eDrawingGuidesDrawing, deleteE2eDrawing } from "./drawing-fixtures";
import { confirmCanvasPlacement } from "./drawing-placement-helpers";
import { prisma } from "../../src/lib/prisma";
import { parseDrawingModelJson, stringifyDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import { assertAuditDatabase, resolveAuditConfiguration } from "../../scripts/drawing-performance-audit/run-config.mjs";

assertAuditDatabase(resolveAuditConfiguration());
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on("console", message => { if (message.type() === "error") messages.push(message.text()); });
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

async function openFixture(page: Page) {
  const fixture = await createE2eDrawingGuidesDrawing();
  await page.goto("/drawings/" + fixture.drawingId);
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  return fixture;
}
async function renameSheet(page: Page, name: string) {
  await page.getByRole("button", { name: "Edit active sheet", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Active Sheet", exact: true });
  await dialog.getByLabel("Sheet name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function setZoom(page: Page, percent: number) {
  const viewport = page.getByTestId("drawing-canvas-viewport");
  const zoom = page.getByTestId("drawing-zoom-display");
  const current = Number((await zoom.textContent())!.replace("%", "")) / 100;
  const box = (await viewport.boundingBox())!;
  await viewport.dispatchEvent("wheel", { ctrlKey: true, cancelable: true, bubbles: true,
    clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
    deltaMode: 0, deltaY: -Math.log(percent / 100 / current) / .0015 });
  await expect(zoom).toHaveText(`${percent}%`);
}

test("header and Add menu remain clear at narrow widths and sidebar sizes", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const fixture = await openFixture(page);
  try {
    const name = "Panel Layout with UPS and Auxiliary Equipment — Internal Controls";
    await renameSheet(page, name);
    const toolbar = page.getByTestId("drawing-sheet-toolbar");
    const panel = page.getByTestId("drawing-sheet-panel");
    await expect(page.getByTestId("active-sheet-heading")).toHaveText(name);
    await expect(page.getByTestId("active-sheet-readout")).toHaveText("Sheet 1 of 2");
    await expect(page.locator(".drawing-sheet-caption")).toHaveCount(0);
    await expect(page.getByRole("tablist", { name: "Drawing representation" })).toHaveCount(0);
    for (const width of [1920, 1440, 1280, 1024, 800]) {
      await page.setViewportSize({ width, height: 1080 });
      const toolbarBox = (await toolbar.boundingBox())!;
      const panelBox = (await panel.boundingBox())!;
      const viewportBox = (await page.getByTestId("drawing-canvas-viewport").boundingBox())!;
      const headingBox = (await page.getByTestId("active-sheet-heading").boundingBox())!;
      expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(toolbarBox.y + 1);
      expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(viewportBox.y + 1);
      for (const button of await toolbar.getByRole("button").all()) {
        const box = (await button.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(panelBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
      }
      await toolbar.getByRole("button", { name: "Add to drawing" }).click();
      const menu = page.getByRole("menu", { name: "Add to drawing" });
      await expect(menu).toBeVisible();
      expect((await toolbar.boundingBox())!.height).toBe(toolbarBox.height);
      expect(await menu.evaluate(element => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
      await page.screenshot({ path: info.outputPath(`toolbar-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(toolbar.getByRole("button", { name: "Add to drawing" })).toBeFocused();
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.getByRole("button", { name: "Collapse symbol library panel" }).click();
    await page.getByRole("button", { name: "Collapse drawing properties panel" }).click();
    await expect(toolbar.getByRole("button", { name: "Add to drawing" })).toBeVisible();
    await page.screenshot({ path: info.outputPath("toolbar-collapsed-sidebars.png") });
  } finally { await deleteE2eDrawing(fixture.drawingId); }
});

test("view round trips preserve the draft, outline DOM, zoom and scroll at every supported test scale", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await openFixture(page);
  try {
    const before = await prisma.drawing.findUniqueOrThrow({ where: { id: fixture.drawingId } });
    await renameSheet(page, "Unsaved Panel Layout");
    const viewport = page.getByTestId("drawing-canvas-viewport");
    const originalNode = await viewport.elementHandle();
    const selector = page.getByRole("combobox", { name: "Drawing view" });
    for (const percent of [20, 100, 206, 800]) {
      await setZoom(page, percent);
      await viewport.evaluate(element => element.scrollTo({ left: 120, top: 140, behavior: "instant" }));
      await page.waitForTimeout(200); // flush the existing 120ms scroll-centre synchronization
      const scroll = await viewport.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }));
      await selector.selectOption("schematic");
      await expect(viewport).toBeHidden();
      const toolbar = page.getByTestId("drawing-sheet-toolbar");
      await expect(toolbar.getByRole("button", { name: "Zoom in preview" })).toBeVisible();
      await expect(toolbar.getByRole("button", { name: "Add to drawing" })).toHaveCount(0);
      await expect(toolbar.getByRole("button", { name: "Edit active sheet" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Unsaved Panel Layout", exact: true })).toHaveCount(1);
      await expect(page.getByText("Read-only · Includes unsaved editor changes")).toBeVisible();
      await expect(page.getByRole("complementary", { name: "Symbol library", exact: true })).toBeHidden();
      await toolbar.getByRole("button", { name: "Zoom in preview" }).click();
      await expect(toolbar.getByRole("button", { name: "Fit preview width" })).toHaveText("125% · Width");
      if (percent === 206) await page.screenshot({ path: info.outputPath("schematic-embedded.png"), fullPage: true });
      await selector.selectOption("outline");
      await expect(viewport).toBeVisible();
      await expect(page.getByTestId("drawing-zoom-display")).toHaveText(`${percent}%`);
      expect(await originalNode!.evaluate(element => element === document.querySelector('[data-testid="drawing-canvas-viewport"]'))).toBe(true);
      await expect.poll(() => viewport.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }))).toEqual(scroll);
      await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    }
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: fixture.drawingId } })).modelJson).toBe(before.modelJson);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing saved" })).toBeDisabled();
    await page.reload();
    await expect(page.getByTestId("active-sheet-heading")).toHaveText("Unsaved Panel Layout");
  } finally { await deleteE2eDrawing(fixture.drawingId); }
});

test("toolbar insertion retains dialogs, keyboard dismissal, placement guard and undo", async ({ page }) => {
  test.setTimeout(60000);
  const fixture = await openFixture(page);
  try {
    const add = page.getByRole("button", { name: "Add to drawing", exact: true });
    await page.getByTestId("drawing-canvas-viewport").focus();
    await page.keyboard.press("Escape");
    await add.focus(); await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /^Panel \/ enclosure/ })).toBeFocused();
    await expect(page.getByRole("menuitem", { name: /^Connected Wire Schedule/ })).toBeDisabled();
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: /^Note/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(add).toBeFocused();
    await add.click();
    await page.getByTestId("active-sheet-heading").click();
    await expect(page.getByRole("menu", { name: "Add to drawing" })).toHaveCount(0);
    await add.click();
    await page.getByRole("menuitem", { name: /^Panel \/ enclosure/ }).click();
    const dialog = page.getByRole("dialog", { name: "Add Panel", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(add).toBeFocused();
    await add.click();
    await page.getByRole("menuitem", { name: /^Note/ }).click();
    await expect(page.getByTestId("placement-session")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Drawing view" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Drawing saved" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("placement-session")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Drawing view" })).toBeEnabled();
    await add.click(); await page.getByRole("menuitem", { name: /^Note/ }).click();
    await confirmCanvasPlacement(page, { x: 150, y: 120 });
    const note = page.getByTestId("canvas-note-hit");
    await expect(note).toHaveCount(1);
    const noteId = await note.getAttribute("data-annotation-id");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await page.keyboard.press("Control+z");
    await expect(note).toHaveCount(0);
    await page.keyboard.press("Control+y");
    await expect(note).toHaveCount(1);
    await expect(note).toHaveAttribute("data-annotation-id", noteId!);
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  } finally { await deleteE2eDrawing(fixture.drawingId); }
});

test("an oversized preview reports its limit and still allows returning to the unchanged outline", async ({ page }) => {
  const fixture = await createE2eDrawingGuidesDrawing();
  try {
    const record = await prisma.drawing.findUniqueOrThrow({ where: { id: fixture.drawingId } });
    const model = parseDrawingModelJson(record.modelJson);
    const placement = model.sheets[0].placements[0], asset = model.assets[0];
    model.assets = Array.from({ length: 101 }, (_, i) => ({ ...asset, id: "toolbar-asset-" + i, tag: "LT-" + (101 + i) }));
    model.sheets[0].placements = model.assets.map((a, i) => ({ ...placement, id: "toolbar-placement-" + i, assetId: a.id, tag: a.tag, x: 20 + i % 10 * 30, y: 20 + Math.floor(i / 10) * 15, scale: .05 }));
    const saved = stringifyDrawingModel(model);
    await prisma.drawing.update({ where: { id: fixture.drawingId }, data: { modelJson: saved } });
    await page.goto("/drawings/" + fixture.drawingId);
    await page.getByRole("combobox", { name: "Drawing view" }).selectOption("schematic");
    await expect(page.getByRole("region", { name: "Schematic preview", exact: true }).getByRole("alert")).toContainText("original drawing is unchanged");
    await expect(page.getByRole("button", { name: "Zoom in preview" })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Drawing view" }).selectOption("outline");
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: fixture.drawingId } })).modelJson).toBe(saved);
  } finally { await deleteE2eDrawing(fixture.drawingId); }
});

test("a delayed schematic chunk can be cancelled without affecting the outline", async ({ page }) => {
  const manifest = JSON.parse(readFileSync(".next/react-loadable-manifest.json", "utf8")) as Record<string, { files: string[] }>;
  const entry = Object.entries(manifest).find(([key]) => key.endsWith(" -> ./drawing-schematic-preview"));
  const chunk = entry?.[1].files.filter(file => file.endsWith(".js")).at(-1);
  expect(chunk).toBeTruthy();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const route = "**/_next/" + chunk;
  await page.route(route, async request => { await gate; await request.continue(); });
  const fixture = await openFixture(page);
  try {
    const view = page.getByRole("combobox", { name: "Drawing view" });
    await view.selectOption("schematic");
    await expect(page.getByText("Preparing schematic preview…")).toBeVisible();
    await view.selectOption("outline");
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
    release();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.getByRole("button", { name: "Drawing saved" })).toBeDisabled();
    await view.selectOption("schematic");
    await expect(page.getByRole("button", { name: "Zoom in preview" })).toBeVisible();
    await view.selectOption("outline");
    await expect(page.getByRole("button", { name: "Drawing saved" })).toBeDisabled();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await deleteE2eDrawing(fixture.drawingId);
  }
});

test("the standalone schematic demonstrator keeps its own heading, tabs and controls", async ({ page }) => {
  await page.goto("/standards/schematic-demo");
  await expect(page.getByRole("tablist", { name: "Circuit representation" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Compare views" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in preview" })).toBeVisible();
  await page.getByRole("button", { name: "Zoom in preview" }).click();
  await expect(page.getByRole("button", { name: "Fit preview width" })).toHaveText("125% · Width");
});
