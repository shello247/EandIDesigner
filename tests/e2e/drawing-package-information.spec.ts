import { randomUUID } from "node:crypto";
import { expect, test } from "./drawing-test";
import { prisma } from "../../src/lib/prisma";
import { assertAuditDatabase } from "../../scripts/drawing-performance-audit/run-config.mjs";
import { createDefaultDrawingModel, parseDrawingModelJson, stringifyDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import { addDrawingSheet } from "../../src/features/drawing_canvas/logic/commands/drawing-sheet-commands";

assertAuditDatabase();

async function fixture(legacy = false) {
  let model = createDefaultDrawingModel({ withTitleSheet: true });
  if (legacy) {
    model = addDrawingSheet(model, "Existing Layout").model;
    model.sheets[1].annotations.push({ id: "keep-note", kind: "note", x: 20, y: 30, text: "Retain engineering content" });
  }
  return prisma.drawing.create({ data: { drawingKey: `package_info_${randomUUID()}`, title: "Package Information Verification", status: "draft", modelJson: stringifyDrawingModel(model) } });
}

test("package title is visible immediately; opening and cancelling section setup changes no data", async ({ page }, info) => {
  const record = await fixture();
  try {
    await page.goto(`/drawings/${record.id}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    await expect(loader.getByRole("button", { name: "Collapse Package Information" })).toHaveAttribute("aria-expanded", "true");
    await expect(loader.getByRole("row").filter({ hasText: "Title Sheet" })).toBeVisible();
    await expect(loader.getByText("Needs section", { exact: true })).toHaveCount(0);
    await expect(loader.getByText("Section 1", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("package-information-title-only.png") });
    await loader.getByRole("button", { name: "Add Section", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add Section", exact: true });
    await expect(dialog.getByRole("button", { name: "Add section", exact: true })).toBeDisabled();
    await dialog.getByLabel("Section title", { exact: true }).fill("Panel Layout");
    page.once("dialog", prompt => prompt.dismiss());
    await dialog.press("Escape");
    await expect(dialog.getByLabel("Section title", { exact: true })).toHaveValue("Panel Layout");
    await dialog.getByRole("button", { name: "Add section", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close Add Section" })).toBeFocused();
    await page.setViewportSize({ width: 390, height: 520 });
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("add-section-narrow.png") });
    page.once("dialog", prompt => prompt.accept());
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(loader.getByRole("button", { name: "Add Section", exact: true })).toBeFocused();
    // Fast interaction on reopening must not lose text to scheduled autofocus.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await loader.getByRole("button", { name: "Add Sheet", exact: true }).click();
      const addSheet = page.getByRole("dialog", { name: "Add Sheet", exact: true });
      await addSheet.getByLabel("New section title").fill(`Wiring ${attempt}`);
      await expect(addSheet.getByLabel("New section title")).toHaveValue(`Wiring ${attempt}`);
      await expect(addSheet.getByRole("button", { name: "Add sheet", exact: true })).toBeEnabled();
      page.once("dialog", prompt => prompt.accept());
      await addSheet.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(loader.getByRole("button", { name: "Add Sheet", exact: true })).toBeFocused();
    }
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: record.id } })).modelJson).toBe(record.modelJson);
    await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
  } finally { await prisma.drawing.delete({ where: { id: record.id } }); }
});

test("new section plus working sheet is atomic, undoable, and leaves legacy content unassigned until explicitly moved", async ({ page }, info) => {
  const record = await fixture(true);
  try {
    await page.goto(`/drawings/${record.id}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    await expect(loader.getByRole("row").filter({ hasText: "Existing Layout" })).toContainText("Needs section");
    await loader.getByRole("button", { name: "Add Sheet", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add Sheet", exact: true });
    await expect(dialog.getByRole("button", { name: "Add sheet", exact: true })).toBeDisabled();
    await dialog.getByLabel("New section title").fill("Panel Layout");
    await dialog.getByLabel("Sheet name", { exact: true }).fill("New Mounting Layout");
    await page.screenshot({ path: info.outputPath("add-sheet-with-section.png") });
    await dialog.getByRole("button", { name: "Add sheet", exact: true }).click();
    await expect(page.getByTestId("active-sheet-readout")).toContainText("Sheet 4 of 4");
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeFocused();
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("active-sheet-readout")).toContainText("of 2");
    await page.keyboard.press("Control+Shift+z");
    await expect(page.getByTestId("active-sheet-readout")).toContainText("of 4");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
    const saved = parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id: record.id } })).modelJson);
    const before = parseDrawingModelJson(record.modelJson);
    expect(saved.sheets.slice(0, 2)).toEqual(before.sheets);
    expect(saved.assets).toEqual(before.assets);
    expect(saved.sheets[2].sectionTitlePage?.title).toBe("Panel Layout");
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await expect(loader.getByText("Section 1", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("legacy-warning-and-section.png") });
    const legacy = loader.getByRole("row").filter({ hasText: "Existing Layout" });
    await legacy.getByRole("button", { name: "Actions for Existing Layout" }).click();
    await legacy.getByRole("menuitem", { name: "Move to another section" }).click();
    const move = page.getByRole("dialog", { name: "Move sheet to section" });
    await expect(move.getByRole("option")).toHaveCount(1);
    await move.getByRole("button", { name: "Move sheet", exact: true }).click();
    await loader.getByRole("button", { name: "Expand Panel Layout" }).click();
    await expect(legacy).not.toContainText("Needs section");
    await loader.getByRole("button", { name: "Close sheet loader" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
    const moved = parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id: record.id } })).modelJson);
    expect(moved.sheets.at(-1)).toEqual(before.sheets[1]);
    expect(moved.sheets[0]).toEqual(before.sheets[0]);
  } finally { await prisma.drawing.delete({ where: { id: record.id } }); }
});

test("direct Add Section assigns Section 1 and preselects it for working sheets", async ({ page }) => {
  const record = await fixture();
  try {
    await page.goto(`/drawings/${record.id}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    await loader.getByRole("button", { name: "Add Section", exact: true }).click();
    const section = page.getByRole("dialog", { name: "Add Section", exact: true });
    await section.getByLabel("Section title", { exact: true }).fill("Internal Wiring");
    await section.getByRole("button", { name: "Add section", exact: true }).click();
    await expect(page.locator('[data-section-title-page="true"]')).toContainText("SECTION 1");
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await loader.getByRole("button", { name: "Add Sheet", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Add Sheet", exact: true });
    await expect(sheet.getByLabel("Section", { exact: true }).locator("option:checked")).toHaveText("Section 1 — Internal Wiring");
    await sheet.getByLabel("Sheet name", { exact: true }).fill("PLC Wiring");
    await sheet.getByRole("button", { name: "Add sheet", exact: true }).click();
    await expect(page.getByTestId("active-sheet-readout")).toContainText("Sheet 3 of 3");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
    const saved = parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id: record.id } })).modelJson);
    expect(saved.sheets.map(s => s.kind)).toEqual(["title_sheet", "section_title", "drawing"]);
    expect(saved.sheets[0]).toEqual(parseDrawingModelJson(record.modelJson).sheets[0]);
  } finally { await prisma.drawing.delete({ where: { id: record.id } }); }
});
