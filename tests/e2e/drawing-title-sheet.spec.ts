import { expect, test } from "./drawing-test";
import { prisma } from "../../src/lib/prisma";
import { createDefaultDrawingModel, parseDrawingModelJson, stringifyDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import { assertAuditDatabase } from "../../scripts/drawing-performance-audit/run-config.mjs";

assertAuditDatabase();
test.describe.configure({ mode: "serial" });

test("creates and edits the shared Title Sheet, retaining draft protections and print output", async ({ page, request }, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const title = `E2E Title Sheet ${Date.now()}`;
  const project = await prisma.project.create({ data: { name: title + " project" } });
  await page.goto("/drawings/new?projectId=" + project.id);
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Create blank drawing" }).click();
  await expect(page).toHaveURL(/\/drawings\/(?!new$)[^/?]+$/);
  const id = page.url().split("/").at(-1)!;
  const edit = page.getByRole("button", { name: "Edit Title Sheet", exact: true });
  await expect(edit).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Drawing view" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add to drawing", exact: true })).toBeDisabled();
  const cover = page.locator('[data-package-title-sheet="true"]');
  await expect(cover).toContainText(title);
  const storedBefore = await prisma.drawing.findUniqueOrThrow({ where: { id } });
  expect(parseDrawingModelJson(storedBefore.modelJson).sheets[0].kind).toBe("title_sheet");
  await page.screenshot({ path: testInfo.outputPath("title-sheet-initial.png"), fullPage: true });

  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Edit Title Sheet" });
  await expect(dialog.getByLabel("Drawing title")).toBeFocused();
  await dialog.getByLabel("Drawing title").fill("");
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Enter a drawing title");
  await dialog.getByLabel("Drawing title").fill(title + " — revised");
  for (const [label, value] of Object.entries({ Project: "Tank controls", Client: "Example engineering", "Drawing number": "TC-001", Revision: "B", Date: "2026-09-10", "Prepared by": "Designer", "Checked by": "Reviewer" })) {
    await dialog.getByLabel(label, { exact: true }).fill(value);
  }
  // Dismissal refusal and focus wrap leave every field intact.
  page.once("dialog", event => event.dismiss());
  await dialog.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Apply", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close Edit Title Sheet" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("title-sheet-editor.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(edit).toBeFocused();
  await expect(cover).toContainText("TC-001");
  await expect(cover).toContainText("Reviewer");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
  await page.reload();
  await expect(cover).toContainText("Tank controls");
  await expect(cover).toContainText(title + " — revised");

  await page.getByRole("button", { name: "Drawing Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Drawing Settings" });
  await settings.getByRole("tab", { name: "Printed Title Block" }).click();
  await expect(settings.getByLabel("Client", { exact: true })).toHaveValue("Example engineering");
  await settings.getByLabel("Client", { exact: true }).fill("Changed through drawing settings");
  await settings.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(cover).toContainText("Changed through drawing settings");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
  const stored = await prisma.drawing.findUniqueOrThrow({ where: { id } });
  const model = parseDrawingModelJson(stored.modelJson);
  expect(stored.title).toBe(title + " — revised");
  expect(model.titleBlock).toMatchObject({ drawingNumber: "TC-001", client: "Changed through drawing settings" });
  expect(model.sheets[0]).not.toHaveProperty("titleBlock");
  const print = await request.get(`/drawings/${id}/print`);
  expect(print.ok()).toBe(true);
  expect(await print.text()).toContain('data-package-title-sheet="true"');
  expect(await print.text()).toContain("Changed through drawing settings");
  const pdf = await request.get(`/drawings/${id}/pdf`, { timeout: 60000 });
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.screenshot({ path: testInfo.outputPath("title-sheet-populated.png"), fullPage: true });
  await page.setViewportSize({ width: 360, height: 760 });
  await edit.click();
  await expect(dialog.getByRole("button", { name: "Apply", exact: true })).toBeInViewport();
  expect(await dialog.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: testInfo.outputPath("title-sheet-mobile.png"), fullPage: true });
  await dialog.getByLabel("Client", { exact: true }).fill("Discard this");
  page.once("dialog", event => event.accept());
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await edit.click();
  await expect(dialog.getByLabel("Client", { exact: true })).toHaveValue("Changed through drawing settings");
  expect(errors).toEqual([]);
});

test("existing blank first sheets convert only by explicit action, populated ones stay unchanged", async ({ page }) => {
  test.setTimeout(90000);
  for (const populated of [false, true]) {
    const model = createDefaultDrawingModel();
    if (populated) model.sheets[0].annotations.push({ id: "keep", kind: "note", x: 20, y: 30, text: "Keep existing engineering content" });
    const record = await prisma.drawing.create({ data: { drawingKey: `title_sheet_legacy_${Date.now()}_${populated}`, title: "Legacy package", status: "draft", modelJson: stringifyDrawingModel(model) } });
    await page.goto(`/drawings/${record.id}`);
    await page.getByRole("button", { name: "Edit active sheet", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Active Sheet" });
    const convert = dialog.getByRole("button", { name: "Convert to Title Sheet" });
    if (populated) {
      await expect(convert).toHaveCount(0);
      expect((await prisma.drawing.findUniqueOrThrow({ where: { id: record.id } })).modelJson).toBe(record.modelJson);
      continue;
    }
    await expect(convert).toBeVisible();
    page.once("dialog", event => event.dismiss());
    await convert.click();
    await expect(dialog).toBeVisible();
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: record.id } })).modelJson).toBe(record.modelJson);
    page.once("dialog", event => event.accept());
    await convert.click();
    await expect(page.getByRole("dialog", { name: "Edit Title Sheet" })).toBeVisible();
    await page.getByRole("dialog", { name: "Edit Title Sheet" }).getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("button", { name: "Edit Title Sheet", exact: true })).toBeVisible();
    const saved = parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id: record.id } })).modelJson);
    expect(saved.sheets[0].id).toBe(model.sheets[0].id);
    expect(saved.sheets[0].kind).toBe("title_sheet");
  }
});
