import { expect, test, type Page } from "./drawing-test";
import fs from "node:fs";
import path from "node:path";
import {
  createE2ePanelComponentPackage,
  deleteE2eDrawing,
  deleteE2eSymbol,
} from "./drawing-fixtures";
import {
  ensureWireCatalogConfigured,
  openPanelEngineeringWorkbench,
  selectPanelEngineeringView,
} from "./panel-workflow-helpers";

test("loads Wire Catalog only on request and preserves close/reopen and retry behavior", async ({ page }) => {
  // Resolve the actual production chunk instead of relying on a build-specific hash.
  const chunksRoot = path.resolve(".next/static/chunks");
  const catalogueChunks = fs.readdirSync(chunksRoot, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".js"))
    .filter((entry) => fs.readFileSync(path.join(chunksRoot, entry), "utf8")
      .includes("Approved wire type, size, and color combinations"));
  expect(catalogueChunks.length).toBeGreaterThan(0);
  const requests: string[] = [];
  let holdRequests = false;
  let releaseChunk: () => void = () => undefined;
  const blockedChunk = new Promise<void>((resolve) => { releaseChunk = resolve; });
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (catalogueChunks.some((chunk) => new URL(route.request().url()).pathname
      .endsWith(`/chunks/${chunk.replaceAll("\\", "/")}`))) {
      requests.push(route.request().url());
      if (holdRequests) await blockedChunk;
    }
    await route.continue();
  });
  const fixture = await createE2ePanelComponentPackage();
  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await expect(page.getByRole("button", { name: "Open sheet loader" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Loading Wire Catalog" })).toHaveCount(0);
    expect(requests).toEqual([]);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    await loader.getByRole("button", { name: "Expand Front Matter" }).click();
    await loader.getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" }).click();
    const workbench = await openPanelEngineeringWorkbench(page);
    await selectPanelEngineeringView(workbench, "Internal Wires");
    expect(requests).toEqual([]);
    const more = workbench.getByLabel(/More panel engineering options/);
    holdRequests = true;
    await more.click();
    await workbench.getByRole("menuitem", { name: "Wire Catalog", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Loading Wire Catalog" })).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    releaseChunk();
    const manager = page.getByRole("dialog", { name: "Wire Catalog", exact: true });
    await expect(manager).toBeVisible();
    const name = `E2E lazy catalog ${fixture.drawingId}`;
    await manager.getByLabel("Name", { exact: true }).fill(name);
    await manager.getByLabel("Wire type", { exact: true }).fill("H07V-K");
    await manager.getByLabel("Size", { exact: true }).fill("1.5 mm²");
    await manager.getByLabel("Color", { exact: true }).fill("Blue");
    await manager.getByRole("button", { name: "Close Wire Catalog" }).click();
    await expect(manager).toHaveCount(0);
    await expect(more).toBeFocused();
    await more.click();
    await workbench.getByRole("menuitem", { name: "Wire Catalog", exact: true }).click();
    await expect(manager.getByLabel("Name", { exact: true })).toHaveValue(name);
    await manager.getByRole("button", { name: "Create specification" }).click();
    await expect(manager.getByText("Wire Catalog updated.", { exact: true })).toBeVisible();
    // Exercise an actual handled validation error, then retry without closing the editor.
    await manager.getByLabel("Name", { exact: true }).fill(name);
    await manager.getByLabel("Wire type", { exact: true }).fill("H07V-K");
    await manager.getByLabel("Size", { exact: true }).fill("1.5 mm²");
    await manager.getByLabel("Color", { exact: true }).fill("Blue");
    await manager.getByRole("button", { name: "Create specification" }).click();
    await expect(manager.getByText("A wire catalog entry with this name already exists.", { exact: true })).toBeVisible();
    await expect(manager.getByLabel("Name", { exact: true })).toHaveValue(name);
    await manager.getByLabel("Name", { exact: true }).fill(`${name} retry`);
    await manager.getByRole("button", { name: "Create specification" }).click();
    await expect(manager.getByText("Wire Catalog updated.", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(manager).toHaveCount(0);
    await expect(more).toBeFocused();
    expect(requests).toHaveLength(catalogueChunks.length);
  } finally {
    releaseChunk();
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});

async function expectAuthoringPropertiesWithoutNetworkAnalysis(
  page: Page,
  componentSection: "Terminal Block" | "Panel Component"
) {
  const properties = page.getByRole("complementary", {
    name: "Drawing properties"
  });
  for (const name of [
    /^Asset Identity/,
    /^Engineering Attributes/,
    new RegExp(`^${componentSection}`),
    /^Terminal availability/,
    /^Connection Display/
  ]) {
    await expect(properties.getByRole("button", { name })).toBeVisible();
  }
  await expect(
    properties.getByRole("button", {
      name: /^Location \/ Enclosure/,
      includeHidden: true
    })
  ).toHaveCount(0);
  await expect(
    properties.getByRole("combobox", {
      name: "Contained in panel",
      includeHidden: true
    })
  ).toHaveCount(0);
  await expect(
    properties.getByRole("button", {
      name: /^Electrical Network/,
      includeHidden: true
    })
  ).toHaveCount(0);
  await expect(
    properties.getByRole("button", {
      name: /^(Highlight .*network|Clear network highlight|Trace connections)/,
      includeHidden: true
    })
  ).toHaveCount(0);
  await expect(
    properties.getByRole("combobox", {
      name: /^Trace (from|to)$/,
      includeHidden: true
    })
  ).toHaveCount(0);
  await expect(
    properties.getByRole("list", {
      name: "Electrical path provenance",
      includeHidden: true
    })
  ).toHaveCount(0);
  await expect(properties.getByText("Electrical path", { exact: true })).toHaveCount(0);
}

test("authors, removes, re-represents, and reloads an internal panel wire", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const fixture = await createE2ePanelComponentPackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const sheetLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    await sheetLoader
      .getByRole("button", { name: "Expand Front Matter" })
      .click();
    await sheetLoader
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const queue = await openPanelEngineeringWorkbench(page);
    await queue
      .getByRole("row", { name: /TB-101/ })
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await queue
      .getByRole("row", { name: /MCB-101/ })
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await queue.getByRole("button", { name: "Close", exact: true }).click();

    const sourceMarker = page.locator(
      '[data-anchor-marker$=":T1_TOP"]',
    );
    await expect(sourceMarker).toHaveAttribute("data-anchor-status", "available");
    await page.getByRole("button", { name: "Wire", exact: true }).click();
    await expect(
      page.getByTestId("canvas-anchor-availability-legend"),
    ).toBeVisible();
    await page.locator('[data-anchor-hotspot$=":T1_TOP"]').click();
    const endpointInspector = page.getByTestId("connection-endpoint-inspector");
    await expect(endpointInspector).toBeVisible();
    await expect(endpointInspector).toContainText("TB-101");
    await expect(endpointInspector).toContainText("Click to add a bend");
    await expect(page.getByTestId("canvas-anchor-tooltip")).toHaveCount(0);

    const drawingOverlay = page.getByLabel("Interactive drawing overlay");
    const overlayBounds = await drawingOverlay.boundingBox();
    expect(overlayBounds).not.toBeNull();
    await drawingOverlay.click({
      position: {
        x: overlayBounds!.width * 0.5,
        y: overlayBounds!.height * 0.72,
      },
    });
    await expect(
      page.getByTestId("canvas-guided-connection-waypoint"),
    ).toHaveCount(1);

    await page.locator('[data-anchor-hotspot$=":LINE"]').hover();
    await expect(
      endpointInspector.getByTestId("connection-hovered-endpoint"),
    ).toContainText("LINE");
    await page.locator('[data-anchor-hotspot$=":LINE"]').click();
    const wireDialog = page.getByRole("dialog", {
      name: "Create internal wire",
    });
    await ensureWireCatalogConfigured(page, wireDialog);
    await expect(wireDialog.getByLabel("Wire #")).toHaveValue("001");
    await expect(wireDialog.getByLabel("Wire ID")).toHaveValue(
      "TB-101:T1(001)",
    );
    await wireDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(endpointInspector).toBeVisible();
    await expect(
      page.getByTestId("canvas-guided-connection-waypoint"),
    ).toHaveCount(1);
    await page.locator('[data-anchor-hotspot$=":LINE"]').click();
    await expect(wireDialog).toBeVisible();
    await wireDialog.getByRole("button", { name: "Create wire" }).click();

    await expect(page.getByTestId("drawing-toast")).toContainText(
      "TB-101:T1(001) added",
    );
    await expect(sourceMarker).toHaveAttribute("data-anchor-status", "occupied");
    const internalWireSection = page.getByRole("button", {
      name: /^Internal Wire/
    });
    await expect(internalWireSection).toHaveAttribute("aria-expanded", "false");
    await internalWireSection.click();
    await expect(page.getByText("TB-101:T1", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Remove wire" }).click();
    const deleteDialog = page.getByRole("dialog", {
      name: "Remove internal wire",
    });
    await deleteDialog
      .getByRole("button", { name: "Remove route only" })
      .click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "physical wire remains",
    );
    await page.getByRole("button", { name: "Wire", exact: true }).click();
    await page.locator('[data-anchor-hotspot$=":T1_TOP"]').click();
    const terminalAvailability = page.getByTestId(
      "selected-terminal-availability-summary"
    );
    await terminalAvailability.getByRole("button").click();
    await expect(terminalAvailability).toContainText(/available.*occupied/);
    const availableTerminals = terminalAvailability.getByRole("region", {
      name: "Available terminals"
    });
    const occupiedTerminals = terminalAvailability.getByRole("region", {
      name: "Occupied terminals"
    });
    await expect(availableTerminals).toContainText("Terminal 2");
    await expect(occupiedTerminals).toContainText("Terminal 1");
    await expect(occupiedTerminals).toContainText("TB-101:T1(001)");

    await expectAuthoringPropertiesWithoutNetworkAnalysis(page, "Terminal Block");

    const refreshedQueue = await openPanelEngineeringWorkbench(page);
    await selectPanelEngineeringView(refreshedQueue, "Internal Wires");
    const wireRow = refreshedQueue.getByRole("row", {
      name: /001.*TB-101:T1\(001\)/,
    });
    await expect(wireRow).toContainText("Unrepresented");
    await wireRow.getByRole("button", { name: "Add representation" }).click();
    await expect(wireRow).toContainText(
      "Sheet 2 - JB001 Detailed Panel Drawing",
    );
    await refreshedQueue
      .getByRole("button", { name: "Close", exact: true })
      .click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved.",
    );
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const reloadedSheetLoader = page.getByRole("dialog", {
      name: "Sheet Loader",
    });
    await reloadedSheetLoader
      .getByRole("button", { name: "Expand Front Matter" })
      .click();
    await reloadedSheetLoader
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();
    const reloadedQueue = await openPanelEngineeringWorkbench(page);
    await selectPanelEngineeringView(reloadedQueue, "Internal Wires");
    await expect(reloadedQueue).toContainText("TB-101:T1(001)");
    await reloadedQueue.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator('[data-anchor-hotspot$=":T1_TOP"]').click();
    await expect(sourceMarker).toHaveAttribute("data-anchor-status", "occupied");
    await expectAuthoringPropertiesWithoutNetworkAnalysis(page, "Terminal Block");
    await page.locator('[data-anchor-hotspot$=":LINE"]').click();
    await expectAuthoringPropertiesWithoutNetworkAnalysis(page, "Panel Component");
    await page.getByRole("button", { name: /^Panel Component/ }).click();
    const component = page.getByRole("complementary", { name: "Drawing properties" })
      .locator("section").filter({ has: page.getByRole("button", { name: /^Panel Component/ }) });
    await expect(component.getByText("Parent panel", { exact: true })).toBeVisible();
    await expect(component.getByText("JB001", { exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
