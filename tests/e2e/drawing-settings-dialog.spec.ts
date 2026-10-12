import { expect, test, type Page } from "./drawing-test";
import { createE2eDrawingGuidesDrawing, deleteE2eDrawing } from "./drawing-fixtures";
import { prisma } from "../../src/lib/prisma";
import { parseDrawingModelJson, stringifyDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import { assertAuditDatabase } from "../../scripts/drawing-performance-audit/run-config.mjs";

assertAuditDatabase();
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on("console", message => { if (message.type() === "error") messages.push(message.text()); });
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });

async function fixture(page: Page) {
  const drawing = await createE2eDrawingGuidesDrawing();
  const project = await prisma.project.create({ data: { name: "Settings source " + drawing.drawingId, client: "Source client" } });
  const original = await prisma.drawing.findUniqueOrThrow({ where: { id: drawing.drawingId } });
  const model = parseDrawingModelJson(original.modelJson);
  model.titleBlock = { client: "Reviewed client", project: "Reviewed process", drawingNumber: "CONTROL-001", revision: "C", preparedBy: "Designer", checkedBy: "Reviewer", date: "As issued" };
  await prisma.drawing.update({ where: { id: original.id }, data: { projectId: project.id, modelJson: stringifyDrawingModel(model) } });
  const before = await prisma.drawing.findUniqueOrThrow({ where: { id: original.id } });
  await page.goto("/drawings/" + original.id);
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  return { ...drawing, project, before, cleanup: async () => { await deleteE2eDrawing(original.id); await prisma.project.delete({ where: { id: project.id } }); } };
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Drawing Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Drawing Settings", exact: true });
  await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
  return dialog;
}

test("compact settings retain drafts, isolate canvas state, and persist only after Save", async ({ page }, info) => {
  test.setTimeout(90000);
  const data = await fixture(page);
  try {
    const viewport = page.getByTestId("drawing-canvas-viewport");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    const zoom = await page.getByTestId("drawing-zoom-display").textContent();
    const beforeSvg = await viewport.locator("svg").first().innerHTML();
    const dialog = await openSettings(page);
    await expect(dialog.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("tabpanel")).toHaveCount(1);
    await dialog.getByLabel("Title", { exact: true }).fill("Settings draft verification");
    await dialog.getByLabel("Drawing description").fill("Local draft only until Save.");
    await dialog.getByRole("tab", { name: "General", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("tab", { name: "Printed Title Block" })).toBeFocused();
    await dialog.getByLabel("Client", { exact: true }).fill("New reviewed client");
    await dialog.getByRole("tab", { name: "Printed Title Block" }).focus();
    await page.keyboard.press("Control+z"); await page.keyboard.press("Delete");
    await expect(dialog.getByRole("tab", { name: "Printed Title Block" })).toBeFocused();
    await expect(dialog.getByLabel("Client", { exact: true })).toHaveValue("New reviewed client");
    await page.keyboard.press("Home");
    await expect(dialog.getByRole("tab", { name: "General", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Settings draft verification");
    await dialog.getByRole("button", { name: "Apply", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close Drawing Settings" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Apply", exact: true })).toBeFocused();
    expect(await viewport.locator("svg").first().innerHTML()).toBe(beforeSvg);
    expect(await page.getByTestId("drawing-zoom-display").textContent()).toBe(zoom);
    expect(await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).toEqual(data.before);
    await page.screenshot({ path: info.outputPath("settings-general.png") });
    await dialog.getByRole("tab", { name: "Printed Title Block" }).click();
    await page.screenshot({ path: info.outputPath("settings-printed.png") });
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Drawing Settings", exact: true })).toBeFocused();
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).modelJson).toBe(data.before.modelJson);
    await openSettings(page);
    await expect(dialog.getByRole("tab", { name: "General", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Settings draft verification");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
    await page.reload(); await openSettings(page);
    await expect(dialog.getByLabel("Drawing description")).toHaveValue("Local draft only until Save.");
    await dialog.getByRole("tab", { name: "Printed Title Block" }).click();
    await expect(dialog.getByLabel("Client", { exact: true })).toHaveValue("New reviewed client");
    const saved = parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).modelJson);
    expect(saved.sheets).toEqual(parseDrawingModelJson(data.before.modelJson).sheets);
    expect(saved.assets).toEqual(parseDrawingModelJson(data.before.modelJson).assets);
  } finally { await data.cleanup(); }
});

test("printed field validation and explicit project-copy review preserve overrides", async ({ page }, info) => {
  test.setTimeout(90000);
  const data = await fixture(page);
  const missingClient = await prisma.project.create({ data: { name: "Source without client " + data.drawingId } });
  try {
    const dialog = await openSettings(page);
    await dialog.getByRole("tab", { name: "Printed Title Block" }).click();
    await dialog.getByLabel("Client", { exact: true }).fill("x".repeat(161));
    await dialog.getByRole("tab", { name: "General", exact: true }).click();
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(dialog.getByLabel("Client", { exact: true })).toBeFocused();
    await expect(dialog.getByLabel("Client", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await dialog.getByLabel("Client", { exact: true }).fill("Keep custom client");
    await dialog.getByRole("tab", { name: "General", exact: true }).click();
    await dialog.getByLabel("Title", { exact: true }).fill("");
    await dialog.getByRole("tab", { name: "Printed Title Block", exact: true }).click();
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
    await dialog.getByLabel("Title", { exact: true }).fill(data.before.title);
    await dialog.getByLabel("Linked Project").selectOption(missingClient.id);
    await dialog.getByRole("tab", { name: "Printed Title Block", exact: true }).click();
    await dialog.getByRole("button", { name: "Use project details", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Cancel copy" })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
    await expect(dialog.getByText("Client unavailable; existing entries will be kept.")).toBeVisible();
    await page.screenshot({ path: info.outputPath("settings-copy-review.png") });
    await dialog.getByRole("button", { name: "Cancel copy" }).click();
    await expect(dialog.getByLabel("Client", { exact: true })).toHaveValue("Keep custom client");
    await dialog.getByRole("button", { name: "Use project details", exact: true }).click();
    await dialog.getByRole("tab", { name: "General", exact: true }).click();
    await dialog.getByRole("tab", { name: "Printed Title Block", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Review project details" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Use project details", exact: true }).click();
    await dialog.getByRole("button", { name: "Use these values" }).click();
    await expect(dialog.getByLabel("Client", { exact: true })).toHaveValue("Keep custom client");
    await expect(dialog.getByLabel("Printed project / process")).toHaveValue(missingClient.name);
    for (const [label, value] of Object.entries({ "Drawing number": "CONTROL-001", Revision: "C", "Prepared by": "Designer", "Checked by": "Reviewer", Date: "As issued" })) {
      await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(value);
    }
    await dialog.getByRole("button", { name: "Use project details", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Already matches");
    expect(await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).toEqual(data.before);
    page.once("dialog", event => event.accept());
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally { await data.cleanup(); await prisma.project.delete({ where: { id: missingClient.id } }); }
});

test("compact layout and discard protection work at narrow and short viewport sizes", async ({ page }, info) => {
  test.setTimeout(90000);
  const data = await fixture(page);
  try {
    for (const dismiss of ["Cancel", "Close Drawing Settings", "Escape"]) {
      const dialog = await openSettings(page);
      await dialog.getByLabel("Title", { exact: true }).fill("Discard this");
      let confirmations = 0;
      const refuse = async (event: import("@playwright/test").Dialog) => { confirmations++; await event.dismiss(); };
      page.once("dialog", refuse);
      if (dismiss === "Escape") await dialog.press("Escape");
      else await dialog.getByRole("button", { name: dismiss, exact: true }).click();
      expect(confirmations).toBe(1);
      await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Discard this");
      await page.mouse.click(2, 2); await expect(dialog).toBeVisible();
      page.once("dialog", event => event.accept());
      if (dismiss === "Escape") await dialog.press("Escape");
      else await dialog.getByRole("button", { name: dismiss, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Drawing Settings", exact: true })).toBeFocused();
    }
    const dialog = await openSettings(page);
    for (const [width, height] of [[1440, 900], [1024, 450], [360, 760]]) {
      await page.setViewportSize({ width, height });
      for (const name of ["General", "Printed Title Block"]) {
        await dialog.getByRole("tab", { name, exact: true }).click();
        await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
        await expect(dialog.getByRole("button", { name: "Apply", exact: true })).toBeInViewport();
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(Math.min(520, height - 48));
        await page.screenshot({ path: info.outputPath(`settings-${name}-${width}x${height}.png`) });
      }
    }
    // CSS magnification is a repeatable layout stress test, not native browser zoom.
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate(() => { document.documentElement.style.zoom = "1.25"; });
    await expect(dialog.getByRole("button", { name: "Apply", exact: true })).toBeInViewport();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.zoom = ""; });
    expect(await prisma.drawing.findUniqueOrThrow({ where: { id: data.drawingId } })).toEqual(data.before);
  } finally { await data.cleanup(); }
});
