import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { listBomItemRows } from "../../src/features/bom_creator/data/list-queries";
import { listBomItems } from "../../src/features/bom_creator/data/queries";

test.describe.configure({ mode: "serial" });

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const displayPrefix = `Scalability ${runId}`;
const itemIdPrefix = `bom_scale_${runId}`;
const categoryA = `scale_category_a_${runId}`;
const categoryB = `scale_category_b_${runId}`;
const manufacturerA = `Scale Manufacturer A ${runId}`;
const manufacturerB = `Scale Manufacturer B ${runId}`;
const symbolId = `bom_scale_symbol_${runId}`;
const activeItemCount = 125;
const markers = {
  itemKey: `SCALE-KEY-ONLY-${runId}`,
  displayName: `Scale Name Only ${runId}`,
  partNumber: `SCALE-PART-ONLY-${runId}`,
  manufacturer: `Scale Maker Only ${runId}`,
  supplierName: `Scale Supplier Only ${runId}`
};

const activeRows = Array.from({ length: activeItemCount }, (_, index) => {
  const number = String(index + 1).padStart(3, "0");

  return {
    id: `${itemIdPrefix}_${number}`,
    itemKey:
      index === 0 ? markers.itemKey : `SCALE-${runId}-${number}`,
    displayName:
      index === 1
        ? `${displayPrefix} ${number} ${markers.displayName}`
        : `${displayPrefix} Item ${number}`,
    category: index % 3 === 0 ? categoryA : categoryB,
    unit: "each",
    manufacturer:
      index === 3
        ? markers.manufacturer
        : index % 2 === 0
          ? manufacturerA
          : manufacturerB,
    partNumber:
      index === 2 ? markers.partNumber : `SCALE-PART-${runId}-${number}`,
    supplierName:
      index === 4 ? markers.supplierName : `Scale Supplier ${index % 4}`,
    supplierSku: `SCALE-SKU-${number}`,
    unitCost: index + 0.5,
    currency: "USD",
    status: "active"
  };
});

const referencedItem = activeRows[1];
const editedItem = activeRows[2];
const unusedDeleteItem = activeRows[5];

function itemsUrl(parameters: Record<string, string | number> = {}): string {
  const search = new URLSearchParams({ q: displayPrefix });

  for (const [key, value] of Object.entries(parameters)) {
    search.set(key, String(value));
  }

  return `/bom/items?${search.toString()}`;
}

async function scriptsContain(
  page: Page,
  urls: readonly string[],
  marker: string
): Promise<boolean> {
  for (const url of urls) {
    const response = await page.request.get(url);

    if (response.ok() && (await response.text()).includes(marker)) {
      return true;
    }
  }

  return false;
}

async function cleanupScalabilityRecords() {
  await prisma.symbol.deleteMany({ where: { id: symbolId } });
  await prisma.bomItem.deleteMany({
    where: { displayName: { startsWith: displayPrefix } }
  });
}

test.beforeAll(async () => {
  await cleanupScalabilityRecords();
  await prisma.bomItem.createMany({ data: activeRows });
  await prisma.bomItem.create({
    data: {
      id: `${itemIdPrefix}_archived`,
      itemKey: `SCALE-${runId}-ARCHIVED`,
      displayName: `${displayPrefix} Archived`,
      category: categoryA,
      unit: "each",
      manufacturer: manufacturerA,
      status: "archived"
    }
  });
  await prisma.symbol.create({
    data: {
      id: symbolId,
      symbolKey: `bom_scale_symbol_${runId}`,
      displayName: `BOM Scalability Symbol ${runId}`,
      category: "instrument",
      status: "approved",
      bomTemplate: {
        create: {
          lines: {
            create: {
              itemId: referencedItem.id,
              lineNumber: 1,
              quantityRule: "fixed_per_assembly",
              quantity: 1
            }
          }
        }
      }
    }
  });
});

test.afterAll(async () => {
  await cleanupScalabilityRecords();
});

test("returns bounded, searchable, stable pages without changing symbol selection", async () => {
  const firstPage = await listBomItemRows({
    query: displayPrefix,
    page: 1,
    pageSize: 50
  });

  expect(firstPage.items).toHaveLength(50);
  expect(firstPage.totalItems).toBe(activeItemCount);
  expect(firstPage.totalPages).toBe(3);
  expect(firstPage.items.every((item) => !("description" in item))).toBe(true);

  for (const marker of Object.values(markers)) {
    const result = await listBomItemRows({
      query: marker.toLowerCase(),
      page: 1,
      pageSize: 50
    });

    expect(result.totalItems, marker).toBe(1);
  }

  const expectedCombinedCount = activeRows.filter(
    (row) =>
      row.category === categoryA && row.manufacturer === manufacturerA
  ).length;
  const combined = await listBomItemRows({
    query: displayPrefix,
    category: categoryA,
    manufacturer: manufacturerA,
    page: 1,
    pageSize: 100
  });

  expect(combined.totalItems).toBe(expectedCombinedCount);
  expect(
    combined.items.every(
      (item) =>
        item.category === categoryA && item.manufacturer === manufacturerA
    )
  ).toBe(true);

  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      listBomItemRows({
        query: displayPrefix,
        page,
        pageSize: 50
      })
    )
  );
  const pageIds = pages.flatMap((result) =>
    result.items.map((item) => item.id)
  );

  expect(pageIds).toHaveLength(activeItemCount);
  expect(new Set(pageIds).size).toBe(activeItemCount);
  expect(pageIds).toEqual(
    activeRows
      .slice()
      .sort(
        (first, second) =>
          first.displayName.localeCompare(second.displayName) ||
          first.itemKey.localeCompare(second.itemKey)
      )
      .map((item) => item.id)
  );

  const symbolOptions = await listBomItems();
  expect(
    symbolOptions.filter((item) => item.id.startsWith(itemIdPrefix))
  ).toHaveLength(activeItemCount);
});

test("keeps filters and pagination canonical through browser history", async ({
  page
}) => {
  await page.goto(itemsUrl());
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(page.getByText(`1-50 of ${activeItemCount} items`)).toBeVisible();
  await expect(page.getByText("Page 1 of 3")).toBeVisible();

  await page.getByRole("link", { name: "Next items page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await page.goBack();
  await expect(page.getByText("Page 1 of 3")).toBeVisible();
  await page.goForward();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();

  await page.goto(itemsUrl({ page: 99 }));
  await expect(page).toHaveURL((url) => url.searchParams.get("page") === "3");
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(page.getByText("Page 3 of 3")).toBeVisible();

  await page.goto(itemsUrl());
  await page.getByLabel("Category").selectOption(categoryA);
  await page.getByLabel("Manufacturer").selectOption(manufacturerA);
  await page.getByLabel("Rows").selectOption("25");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL((url) => {
    return (
      url.searchParams.get("q") === displayPrefix &&
      url.searchParams.get("category") === categoryA &&
      url.searchParams.get("manufacturer") === manufacturerA &&
      url.searchParams.get("pageSize") === "25" &&
      url.searchParams.get("page") === null
    );
  });

  const expectedCombinedCount = activeRows.filter(
    (row) =>
      row.category === categoryA && row.manufacturer === manufacturerA
  ).length;
  await expect(
    page.getByText(`1-${expectedCombinedCount} of ${expectedCombinedCount} items`)
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(itemsUrl());
  await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
  const mobileLayout = await page.evaluate(() => {
    const main = document.querySelector("main");
    const form = document.querySelector("form");

    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      mainWidth: main?.getBoundingClientRect().width ?? 0,
      formWidth: form?.getBoundingClientRect().width ?? 0
    };
  });

  expect(mobileLayout.documentWidth).toBeLessThanOrEqual(
    mobileLayout.viewportWidth
  );
  expect(mobileLayout.mainWidth).toBeGreaterThan(300);
  expect(mobileLayout.formWidth).toBeGreaterThan(275);
});

test("records bounded production route and edit-open measurements", async ({
  page
}) => {
  const routeTimesMs: number[] = [];
  const domContentLoadedTimesMs: number[] = [];
  const editOpenTimesMs: number[] = [];
  const responseBytes: number[] = [];

  for (let run = 0; run < 5; run += 1) {
    const routeStarted = performance.now();
    const response = await page.goto(itemsUrl());
    await expect(page.locator("tbody tr")).toHaveCount(50);
    routeTimesMs.push(Number((performance.now() - routeStarted).toFixed(2)));
    responseBytes.push((await response!.body()).byteLength);
    domContentLoadedTimesMs.push(
      await page.evaluate(() => {
        const navigation = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming;

        return Number(navigation.domContentLoadedEventEnd.toFixed(2));
      })
    );

    const editStarted = performance.now();
    await page
      .locator('tbody button[aria-label^="Edit "]')
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: /^Edit / })).toBeVisible();
    editOpenTimesMs.push(
      Number((performance.now() - editStarted).toFixed(2))
    );
    await page.getByRole("button", { name: "Close item wizard" }).click();
  }

  console.log(
    `Phase 3 production measurements: ${JSON.stringify({
      routeTimesMs,
      domContentLoadedTimesMs,
      editOpenTimesMs,
      responseBytes,
      renderedRows: 50
    })}`
  );
  expect(responseBytes.every((bytes) => bytes < 500_000)).toBe(true);
});

test("loads modal code and data on demand while preserving filtered CRUD state", async ({
  page
}) => {
  const scriptUrls = new Set<string>();
  let actionRequestCount = 0;
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      scriptUrls.add(response.url());
    }
  });
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/bom/items")) {
      actionRequestCount += 1;
    }
  });

  await page.goto(itemsUrl({ pageSize: 25 }));
  await page.waitForLoadState("networkidle");
  const initialScripts = [...scriptUrls];

  expect(actionRequestCount).toBe(0);
  expect(await scriptsContain(page, initialScripts, "Close item wizard")).toBe(
    false
  );
  expect(
    await scriptsContain(page, initialScripts, "Close delete confirmation")
  ).toBe(false);

  const createdName = `${displayPrefix} 000 UI Created`;
  await page.getByRole("button", { name: "New item" }).click();
  await expect(page.getByRole("dialog", { name: "New item" })).toBeVisible();
  expect(actionRequestCount).toBeGreaterThanOrEqual(1);
  expect(
    await scriptsContain(
      page,
      [...scriptUrls].filter((url) => !initialScripts.includes(url)),
      "Close item wizard"
    )
  ).toBe(true);

  await page.locator("#bom-display-name").fill(createdName);
  await page.locator("#bom-category").selectOption("accessory");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByRole("link", { name: createdName })).toBeVisible();
  await expect(page).toHaveURL((url) => {
    return (
      url.searchParams.get("q") === displayPrefix &&
      url.searchParams.get("pageSize") === "25"
    );
  });

  const editedName = `${displayPrefix} 001 Edited`;
  await page
    .getByRole("button", { name: `Edit ${editedItem.displayName}` })
    .click();
  await expect(
    page.getByRole("dialog", { name: `Edit ${editedItem.displayName}` })
  ).toBeVisible();
  await page.locator("#bom-display-name").fill(editedName);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByRole("link", { name: editedName })).toBeVisible();

  await page
    .getByRole("button", { name: `Delete ${unusedDeleteItem.displayName}` })
    .click();
  await expect(
    page.getByRole("dialog", { name: `Delete ${unusedDeleteItem.displayName}` })
  ).toBeVisible();
  expect(
    await scriptsContain(
      page,
      [...scriptUrls].filter((url) => !initialScripts.includes(url)),
      "Close delete confirmation"
    )
  ).toBe(true);
  await page.getByRole("button", { name: "Delete item" }).click();
  await expect(page.getByText("BOM item deleted.")).toBeVisible();
  await expect
    .poll(() =>
      prisma.bomItem.findUnique({ where: { id: unusedDeleteItem.id } })
    )
    .toBeNull();

  await page
    .getByRole("button", { name: `Delete ${referencedItem.displayName}` })
    .click();
  await page.getByRole("button", { name: "Archive item" }).click();
  await expect
    .poll(async () => {
      const item = await prisma.bomItem.findUnique({
        where: { id: referencedItem.id },
        select: { status: true }
      });

      return item?.status;
    })
    .toBe("archived");
  await expect(
    prisma.symbolBomTemplateLine.count({
      where: { itemId: referencedItem.id }
    })
  ).resolves.toBe(1);

  const createdItem = await prisma.bomItem.findFirst({
    where: { displayName: createdName },
    select: { id: true }
  });
  expect(createdItem).not.toBeNull();

  if (createdItem) {
    const createdRow = page.getByRole("row").filter({ hasText: createdName });
    await createdRow.getByRole("button", { name: `Delete ${createdName}` }).click();
    await page.getByRole("button", { name: "Delete item" }).click();
    await expect(page.getByText("BOM item deleted.")).toBeVisible();
    await expect
      .poll(() => prisma.bomItem.findUnique({ where: { id: createdItem.id } }))
      .toBeNull();
  }

  await expect(page).toHaveURL((url) => {
    return (
      url.searchParams.get("q") === displayPrefix &&
      url.searchParams.get("pageSize") === "25"
    );
  });
});
