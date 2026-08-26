import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { createBomGenerationFixture } from "../../src/features/bom_creator/tests/fixtures/bom-generation-fixtures";

test.describe.configure({ mode: "serial" });

test("bounds large drawing BOM payloads and renders only the selected view", async ({
  page
}) => {
  test.setTimeout(120_000);
  const runId = `PERF4_${Date.now()}`;
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey: `${runId}_symbol`,
      displayName: `${runId} Cable Assembly`,
      category: "cable_assembly",
      status: "approved"
    },
    select: { id: true }
  });
  const items: Array<{ id: string; displayName: string }> = [];
  let drawingId: string | undefined;

  try {
    for (let index = 0; index < 5; index += 1) {
      items.push(
        await prisma.bomItem.create({
          data: {
            itemKey: `${runId}-${index + 1}`,
            displayName: `${runId} Browser Item ${index + 1}`,
            category: "accessory",
            unit: "each",
            status: index === 3 ? "archived" : "active"
          },
          select: { id: true, displayName: true }
        })
      );
    }

    await prisma.symbolBomTemplate.create({
      data: {
        symbolId: symbol.id,
        lines: {
          create: [
            "fixed_per_assembly",
            "per_cable_end",
            "per_conductor_termination",
            "per_connection",
            "manual"
          ].map((quantityRule, index) => ({
            itemId: items[index].id,
            lineNumber: index + 1,
            quantityRule,
            quantity: 1
          }))
        }
      }
    });

    const fixture = createBomGenerationFixture(300, { warningHeavy: true });
    fixture.model.assets = fixture.model.assets.map((asset) => ({
      ...asset,
      symbolId: symbol.id
    }));
    fixture.model.sheets = fixture.model.sheets.map((sheet) => ({
      ...sheet,
      placements: sheet.placements.map((placement) => ({
        ...placement,
        symbolId: symbol.id
      }))
    }));
    const drawing = await prisma.drawing.create({
      data: {
        drawingKey: `${runId}_drawing`,
        title: `${runId} Large Drawing`,
        status: "approved",
        modelJson: JSON.stringify(fixture.model)
      },
      select: { id: true }
    });
    drawingId = drawing.id;
    const consolidatedUrl = `/bom?drawingId=${drawing.id}`;
    const initialResponse = await page.request.get("/bom");
    const initialResponseBytes = Buffer.byteLength(await initialResponse.text());
    const routeTimesMs: number[] = [];
    const responseBytes: number[] = [];
    let responseBody = "";

    for (let run = 0; run < 5; run += 1) {
      const startedAt = performance.now();
      const response = await page.request.get(consolidatedUrl);
      routeTimesMs.push(Number((performance.now() - startedAt).toFixed(2)));
      responseBody = await response.text();
      responseBytes.push(Buffer.byteLength(responseBody));
      expect(response.ok()).toBe(true);
    }

    expect(Math.max(...responseBytes)).toBeLessThan(409_406);
    expect(responseBody).not.toContain("C-00300");

    await page.goto(consolidatedUrl);
    await expect(page.getByTestId("generated-bom-view-consolidated")).toBeVisible();
    await expect(page.getByTestId("generated-bom-view-assembly")).toHaveCount(0);
    const connectionRow = page
      .getByTestId("consolidated-bom-table")
      .getByRole("row")
      .filter({ hasText: items[3].displayName });
    await expect(connectionRow).toContainText("600");
    await expect(connectionRow).toContainText("+292 more");

    const assemblyTab = page.getByRole("tab", { name: /Assembly/ });
    await expect(assemblyTab).toHaveAttribute("href", /view=assembly/);
    await page.goto((await assemblyTab.getAttribute("href"))!);
    await expect(page).toHaveURL(/view=assembly/, { timeout: 20_000 });
    await expect(page.getByTestId("assembly-bom-table")).toHaveCount(25);
    await expect(page.getByRole("heading", { name: "C-00001" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "C-00026" })).toHaveCount(0);
    const nextPage = page.getByRole("link", { name: "Next" });
    await expect(nextPage).toHaveAttribute("href", /page=2/);
    await page.goto((await nextPage.getAttribute("href"))!);
    await expect(page).toHaveURL(/page=2/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "C-00026" })).toBeVisible();

    const reviewTab = page.getByRole("tab", { name: /Review/ });
    await expect(reviewTab).toHaveAttribute("href", /view=review/);
    await page.goto((await reviewTab.getAttribute("href"))!);
    await expect(page).toHaveURL(/view=review/, { timeout: 20_000 });
    await expect(page.getByTestId("bom-warning-list").locator(":scope > div")).toHaveCount(50);
    await expect(page.getByText("Archived Item: 300")).toBeVisible();
    await expect(page.getByText("Manual Quantity Required: 300")).toBeVisible();

    console.log(
      `Phase 4 production measurements: ${JSON.stringify({
        initialResponseBytes,
        routeTimesMs,
        responseBytes,
        consolidatedRows: 5,
        assemblyPageSize: 25,
        warningPageSize: 50
      })}`
    );

    await page.goBack();
    await expect(page).toHaveURL(/view=assembly/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "C-00026" })).toBeVisible();
  } finally {
    if (drawingId) {
      await prisma.drawing.deleteMany({ where: { id: drawingId } });
    }
    await prisma.symbol.deleteMany({ where: { id: symbol.id } });
    await prisma.bomItem.deleteMany({
      where: { itemKey: { startsWith: runId } }
    });
  }
});
