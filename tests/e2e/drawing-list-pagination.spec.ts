import { prisma } from "../../src/lib/prisma";
import {
  createDefaultDrawingModel,
  stringifyDrawingModel
} from "../../src/features/drawing_canvas/data/schema";
import { expect, test } from "./drawing-test";

test.describe.configure({ mode: "serial" });

const syntheticPrefix = "audit_list_page_";
const tieTimestamp = new Date("2030-01-01T00:00:00.000Z");

function syntheticId(index: number) {
  return `${syntheticPrefix}${index.toString().padStart(4, "0")}`;
}

async function replaceSyntheticDrawings(count: number) {
  await prisma.drawing.deleteMany({
    where: { id: { startsWith: syntheticPrefix } }
  });

  const model = createDefaultDrawingModel();
  model.sheets.push({
    ...model.sheets[0],
    id: "pagination_sheet_2",
    name: "Pagination sheet 2"
  });
  const modelJson = stringifyDrawingModel(model);

  for (let start = 0; start < count; start += 50) {
    const end = Math.min(start + 50, count);
    await prisma.drawing.createMany({
      data: Array.from({ length: end - start }, (_, offset) => {
        const id = syntheticId(start + offset);
        return {
          id,
          drawingKey: id,
          title: `Drawing ${id}`,
          status: "needs_review",
          modelJson,
          createdAt: tieTimestamp,
          updatedAt: tieTimestamp
        };
      })
    });
  }
}

test("bounds, orders, navigates, and clamps drawing list pages", async ({
  page
}) => {
  test.setTimeout(120000);

  const existing = await prisma.drawing.findMany({
    select: { id: true, status: true }
  });
  await prisma.drawing.updateMany({ data: { status: "archived" } });

  try {
    await replaceSyntheticDrawings(10);
    await page.goto("/drawings?page=invalid");
    await expect(page.getByText("1–10 of 10 drawings")).toBeVisible();
    await expect(page.getByText("Page 1 of 1")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Next drawings page" })
    ).toHaveCount(0);

    await replaceSyntheticDrawings(100);
    await page.goto("/drawings");
    await expect(page.getByText("1–25 of 100 drawings")).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Drawing ${syntheticId(0)}` })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Drawing ${syntheticId(25)}` })
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Next drawings page" }).click();
    await expect(page).toHaveURL(/\/drawings\?page=2$/);
    await expect(page.getByText("26–50 of 100 drawings")).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Drawing ${syntheticId(25)}` })
    ).toBeVisible();

    await replaceSyntheticDrawings(500);
    await page.goto("/drawings?page=20");
    await expect(page.getByText("476–500 of 500 drawings")).toBeVisible();
    await expect(page.getByText("Page 20 of 20")).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Drawing ${syntheticId(499)}` })
    ).toBeVisible();

    await replaceSyntheticDrawings(51);
    await page.goto("/drawings?page=3");
    await expect(page.getByText("51–51 of 51 drawings")).toBeVisible();
    await page
      .getByRole("button", { name: `Delete Drawing ${syntheticId(50)}` })
      .click();
    await page
      .getByRole("button", { name: "Delete drawing", exact: true })
      .click();
    await expect(page).toHaveURL(/\/drawings\?page=2$/);
    await expect(page.getByText("26–50 of 50 drawings")).toBeVisible();
  } finally {
    await prisma.drawing.deleteMany({
      where: { id: { startsWith: syntheticPrefix } }
    });
    for (const row of existing) {
      await prisma.drawing.update({
        where: { id: row.id },
        data: { status: row.status }
      });
    }
  }
});
