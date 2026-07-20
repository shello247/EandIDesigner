import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import {
  createE2eNmt81ToNrf81Drawing,
  deleteE2eDrawing
} from "./drawing-fixtures";

async function createBomItem(
  page: Page,
  input: {
    displayName: string;
    category?: string;
    newCategoryName?: string;
    unit?: string;
    attachImage?: boolean;
    newManufacturerName?: string;
    supplierName?: string;
    supplierSku?: string;
    unitCost?: string;
  }
): Promise<{ id: string; itemKey: string }> {
  await page.getByRole("button", { name: "New item" }).click();
  await expect(page.getByRole("dialog", { name: "New item" })).toBeVisible();
  await expect(page.getByText("Assigned on save")).toBeVisible();
  await page.locator("#bom-display-name").fill(input.displayName);

  if (input.newCategoryName) {
    await page.getByRole("button", { name: "Add category" }).click();
    const categoryDialog = page.getByRole("dialog", { name: "Add category" });
    await categoryDialog.locator("#bom-small-option-name").fill(input.newCategoryName);
    await categoryDialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(categoryDialog).toHaveCount(0);
  } else {
    await page.locator("#bom-category").selectOption(input.category ?? "accessory");
  }

  await page.locator("#bom-unit").selectOption(input.unit ?? "each");

  if (input.newManufacturerName) {
    await page.getByRole("button", { name: "Add manufacturer" }).click();
    const manufacturerDialog = page.getByRole("dialog", {
      name: "Add manufacturer"
    });
    await manufacturerDialog
      .locator("#bom-small-option-name")
      .fill(input.newManufacturerName);
    await manufacturerDialog
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await expect(manufacturerDialog).toHaveCount(0);
  }

  await page.getByRole("button", { name: "Next", exact: true }).click();

  if (input.attachImage) {
    await page.locator('input[type="file"]').setInputFiles({
      name: "bom-e2e.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64"
      )
    });
    await expect(page.getByText("bom-e2e.png")).toBeVisible();
  }

  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("button", { name: "Next", exact: true }).click();

  if (input.supplierName) {
    await page.locator("#bom-supplier-name").fill(input.supplierName);
  }

  if (input.supplierSku) {
    await page.locator("#bom-supplier-sku").fill(input.supplierSku);
  }

  if (input.unitCost) {
    await page.locator("#bom-unit-cost").fill(input.unitCost);
    await page.locator("#bom-currency").fill("USD");
  }

  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("BOM item saved.")).toBeVisible();

  const row = await prisma.bomItem.findFirst({
    where: { displayName: input.displayName },
    select: { id: true, itemKey: true }
  });

  if (!row) {
    throw new Error(`Created BOM item was not found: ${input.displayName}`);
  }

  return row;
}

test("creates symbol mini BOM items and generates a drawing BOM", async ({
  page
}) => {
  test.setTimeout(120_000);
  const runId = Date.now().toString();
  const itemLabels = {
    cable: `E2E Cable ${runId}`,
    gland: `E2E Cable Gland ${runId}`,
    wireEnd: `E2E Wire End ${runId}`,
    sealant: `E2E Sealant ${runId}`,
    spare: `E2E Spare ${runId}`
  };
  const symbol = await prisma.symbol.findUnique({
    where: { symbolKey: "clx_cable_1_pair" },
    select: { id: true }
  });
  let drawingId: string | undefined;

  if (!symbol) {
    throw new Error("Seeded cable symbol was not found.");
  }

  try {
    await page.goto("/bom/items");
    const cableItem = await createBomItem(page, {
      displayName: itemLabels.cable,
      newCategoryName: `E2E Custom Category ${runId}`,
      unit: "m",
      attachImage: true,
      newManufacturerName: `E2E Manufacturer ${runId}`,
      supplierName: "E2E Supplier",
      supplierSku: `SUP-${runId}`,
      unitCost: "12.50"
    });

    await page.goto(`/bom/items/${cableItem.id}`);
    await expect(page.getByRole("heading", { name: itemLabels.cable })).toBeVisible();
    await expect(page.getByText(`E2E Manufacturer ${runId}`)).toBeVisible();
    await expect(page.getByText("E2E Supplier")).toBeVisible();
    await expect(page.getByText("USD 12.50")).toBeVisible();
    await page.goto("/bom/items");

    await createBomItem(page, {
      displayName: itemLabels.gland,
      category: "cable_gland"
    });
    await createBomItem(page, {
      displayName: itemLabels.wireEnd,
      category: "wire_end"
    });
    await createBomItem(page, {
      displayName: itemLabels.sealant,
      category: "sealant"
    });
    await createBomItem(page, {
      displayName: itemLabels.spare,
      category: "accessory"
    });

    const spareRow = page.getByRole("row").filter({ hasText: itemLabels.spare });
    await spareRow.getByRole("button", { name: `Edit ${itemLabels.spare}` }).click();
    await expect(
      page.getByRole("dialog", { name: `Edit ${itemLabels.spare}` })
    ).toBeVisible();
    await page.locator("#bom-display-name").fill(`${itemLabels.spare} Edited`);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save item" }).click();
    await expect(page.getByText("BOM item saved.")).toBeVisible();

    const editedSpareLabel = `${itemLabels.spare} Edited`;
    await expect(page.getByRole("link", { name: editedSpareLabel })).toBeVisible();
    const editedSpareRow = page
      .getByRole("row")
      .filter({ hasText: editedSpareLabel });
    await editedSpareRow
      .getByRole("button", { name: `Delete ${editedSpareLabel}` })
      .click();
    await expect(
      page.getByRole("dialog", { name: `Delete ${editedSpareLabel}` })
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete item" }).click();
    await expect(page.getByRole("link", { name: editedSpareLabel })).toHaveCount(0);

    await page.goto(`/symbols/${symbol.id}`);
    await page.getByRole("tab", { name: "BOM" }).click();
    await expect(page.getByRole("heading", { name: "Symbol Mini BOM" })).toBeVisible();

    for (const itemName of [
      itemLabels.cable,
      itemLabels.gland,
      itemLabels.wireEnd,
      itemLabels.sealant
    ]) {
      await page.getByRole("button", { name: "Add item" }).click();
      const picker = page.getByRole("dialog", { name: "Select BOM item" });
      await picker.locator("#bom-item-picker-search").fill(itemName);
      await picker.getByRole("button", { name: "Search", exact: true }).click();
      await picker.getByRole("button", { name: new RegExp(itemName) }).click();
    }
    await page.getByLabel("Quantity rule 1").selectOption("fixed_per_assembly");
    await page.getByLabel("Quantity 1").fill("1");
    await page.getByLabel("Quantity rule 2").selectOption("per_cable_end");
    await page.getByLabel("Quantity 2").fill("1");
    await page
      .getByLabel("Quantity rule 3")
      .selectOption("per_conductor_termination");
    await page.getByLabel("Quantity 3").fill("1");
    await page.getByLabel("Quantity rule 4").selectOption("per_connection");
    await page.getByLabel("Quantity 4").fill("1");

    await page.getByRole("button", { name: "Save BOM" }).click();
    await expect(page.getByText("Symbol BOM saved.")).toBeVisible();

    drawingId = await createE2eNmt81ToNrf81Drawing();
    await page.goto(`/bom?drawingId=${drawingId}`);
    await expect(page.getByRole("heading", { name: "Consolidated BOM" })).toBeVisible();
    const consolidatedBom = page.getByTestId("consolidated-bom-table");

    await expect(
      consolidatedBom.getByRole("row").filter({ hasText: itemLabels.gland })
    ).toContainText("2");
    await expect(
      consolidatedBom.getByRole("row").filter({ hasText: itemLabels.wireEnd })
    ).toContainText("4");
    await expect(
      consolidatedBom.getByRole("row").filter({ hasText: itemLabels.sealant })
    ).toContainText("4");
    await page.getByRole("tab", { name: /Assembly/ }).click();
    await expect(page.getByRole("heading", { name: "Assembly View" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "C-101" })).toBeVisible();
  } finally {
    await deleteE2eDrawing(drawingId);
    await prisma.symbolBomTemplate.deleteMany({
      where: { symbolId: symbol.id }
    });
    await prisma.bomItem.deleteMany({
      where: {
        displayName: {
          in: [...Object.values(itemLabels), `${itemLabels.spare} Edited`]
        }
      }
    });
    await prisma.bomItemCategory.deleteMany({
      where: { name: `e2e_custom_category_${runId}` }
    });
    await prisma.bomItemManufacturer.deleteMany({
      where: { name: `E2E Manufacturer ${runId}` }
    });
  }
});
