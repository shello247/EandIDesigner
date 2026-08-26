import { expect, test, type Locator, type Page } from "@playwright/test";
import { createE2eNmt81ToNrf81Drawing } from "./drawing-fixtures";

test.describe.configure({ mode: "serial" });

async function addSymbolFromLibrary(
  page: Page,
  categoryName: RegExp,
  symbolName: string
) {
  const libraryToggle = page.getByRole("button", {
    name: "Expand Symbol Library"
  });
  if (await libraryToggle.count()) {
    await libraryToggle.click();
  }
  const category = page.getByRole("button", { name: categoryName });

  if ((await category.getAttribute("aria-expanded")) !== "true") {
    await category.click();
  }

  await page.getByRole("button", { name: symbolName, exact: true }).click();
}

async function addCableFromLibrary(page: Page) {
  await addSymbolFromLibrary(page, /Cable Assembly 1/, "CLX Cable 1 Pair");
}

async function activateSheet(page: Page, sheetName: string) {
  await page.getByRole("button", { name: "Open sheet loader" }).click();
  const dialog = page.getByRole("dialog", { name: "Sheet Loader" });
  const expandSection = dialog.getByRole("button", { name: /^Expand / }).first();
  if (await expandSection.count()) {
    await expandSection.click();
  }
  const row = dialog
    .getByRole("cell", { name: sheetName, exact: true })
    .locator("..");
  await row.getByRole("button", { name: "Load", exact: true }).click();
}

async function addNoteFromCanvas(page: Page) {
  await page.getByRole("button", { name: "Add to drawing" }).click();
  await page.getByRole("menuitem", { name: /Note/ }).click();
}

async function expandInspectorSection(page: Page, name: RegExp) {
  const section = page.getByRole("button", { name });
  await expect(section).toBeVisible();
  if ((await section.getAttribute("aria-expanded")) !== "true") {
    await section.click();
  }
}

test("creates, saves, reloads, and edits the NMT81 to NRF81 sample drawing", async ({
  page
}) => {
  test.setTimeout(90000);

  const drawingId = await createE2eNmt81ToNrf81Drawing();
  await page.goto(`/drawings/${drawingId}`);
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
    timeout: 15000
  });

  await expect(
    page.getByRole("heading", { name: "NMT81 to NRF81 Wiring" })
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Drawing measurement units" })
  ).toHaveCount(0);
  await page
    .locator(
      'svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="nmt81"]'
    )
    .click({ force: true });
  const assetIdentitySection = page.getByRole("button", {
    name: /Asset Identity/
  });
  await expect(assetIdentitySection).toBeVisible();
  if ((await assetIdentitySection.getAttribute("aria-expanded")) !== "true") {
    await assetIdentitySection.click();
  }
  await expect(page.getByLabel("Tag / ID")).toHaveValue("TT-101");
  await page.getByLabel("Title", { exact: true }).fill("Tank Temperature Probe");
  await page.getByLabel("Title", { exact: true }).press("Enter");
  if ((await assetIdentitySection.getAttribute("aria-expanded")) !== "true") {
    await assetIdentitySection.click();
  }
  await page
    .getByLabel("General description", { exact: true })
    .fill("Average tank temperature measurement");
  await page
    .getByLabel("General description", { exact: true })
    .press("Control+Enter");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Tank Temperature Probe"
  );
  await expect(page.getByLabel("General description", { exact: true })).toHaveValue(
    "Average tank temperature measurement"
  );
  const engineeringAttributes = page.getByRole("button", {
    name: /Engineering Attributes/
  });
  await engineeringAttributes.click();
  await page.getByRole("button", { name: "Add attribute" }).click();
  let attributeDialog = page.getByRole("dialog", {
    name: "Add engineering attribute"
  });
  await attributeDialog
    .getByLabel("Add engineering attribute")
    .selectOption("engineering_purpose");
  await attributeDialog
    .getByLabel("Purpose / Description", { exact: true })
    .fill("Measure the tank's average temperature");
  await attributeDialog.getByRole("button", { name: "Add attribute" }).click();
  await page.getByRole("button", { name: "Add attribute" }).click();
  attributeDialog = page.getByRole("dialog", {
    name: "Add engineering attribute"
  });
  await attributeDialog
    .getByLabel("Add engineering attribute")
    .selectOption("nominal_voltage");
  await attributeDialog
    .getByLabel("Nominal voltage", { exact: true })
    .fill("24");
  await attributeDialog.getByRole("button", { name: "Add attribute" }).click();
  await expect(engineeringAttributes).toContainText("2 recorded");

  await page.getByRole("button", { name: "Asset Manager" }).click();
  const assetManager = page.getByRole("dialog", { name: "Asset Manager" });
  const instrumentCategory = assetManager
    .getByRole("group", { name: "Asset categories" })
    .getByRole("button", {
      name: /Level Devices \/ Instruments.*1 asset/
    });
  await instrumentCategory.click();
  await expect(
    assetManager.getByRole("heading", { name: "TT-101", exact: true })
  ).toBeVisible();
  const managerAttributes = assetManager.getByRole("button", {
    name: /Engineering Attributes/
  });
  await managerAttributes.click();
  const managerAttributeList = assetManager.locator(
    "[data-engineering-attributes]"
  );
  await expect(managerAttributeList).toContainText(
    "Measure the tank's average temperature"
  );
  await expect(managerAttributeList).toContainText("24 V");
  await assetManager
    .getByRole("button", { name: "Close asset manager" })
    .click();

  await page.getByRole("button", { name: "Browse connections" }).click();
  const connectionsDialog = page.getByRole("dialog", { name: "Connections" });
  await expect(connectionsDialog).toBeVisible();
  await expect(connectionsDialog.getByTestId("drawing-connection-card")).toHaveCount(4);
  await expect(connectionsDialog.getByTestId("drawing-connection-group")).toHaveCount(2);
  await expect(connectionsDialog.getByText("TT-101 ↔ C-101")).toBeVisible();
  await expect(connectionsDialog.getByText("C-101 ↔ TSM-101")).toBeVisible();
  await connectionsDialog
    .getByTestId("drawing-connection-card")
    .first()
    .click();
  await expect(connectionsDialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Connection / })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await expect(page.getByRole("heading", { name: "Selected Placement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Auto-route all" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show route handles" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export SVG" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(0);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: /Preview PDF/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const pdfResponse = await page.request.get(`/drawings/${drawingId}/pdf`);
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe("%PDF");
  const printResponse = await page.request.get(`/drawings/${drawingId}/print`);
  expect(printResponse.ok()).toBeTruthy();
  const printHtml = await printResponse.text();
  expect(printHtml).toContain("window.print()");
  expect(printHtml).toContain("Back to drawing");
  expect(printHtml.indexOf('data-placement-id="')).toBeLessThan(
    printHtml.indexOf('data-connection-id="')
  );
  await expect(page.getByRole("button", { name: "Validate" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Validation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fit drawing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bundle view" })).toHaveCount(0);
  await page.getByRole("button", { name: "Drawing Settings" }).click();
  const drawingSettings = page.getByRole("dialog", {
    name: "Drawing Settings"
  });
  await drawingSettings
    .getByRole("group", { name: "Drawing settings measurement units" })
    .getByRole("button", { name: "in", exact: true })
    .click();
  await expect(
    drawingSettings
      .getByRole("group", { name: "Drawing settings measurement units" })
      .getByRole("button", { name: "in", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await drawingSettings.getByLabel("Client").fill("Enermach");
  await drawingSettings
    .getByLabel("Project / process")
    .fill("Tank Automation");
  await drawingSettings.getByLabel("Drawing number").fill("EI-001");
  await drawingSettings.getByRole("button", { name: "Apply" }).click();
  await expect(drawingSettings).toHaveCount(0);
  await addNoteFromCanvas(page);
  const selectedNoteSection = page.getByRole("button", {
    name: /Selected Note/
  });
  await expect(selectedNoteSection).toBeVisible();
  if ((await selectedNoteSection.getAttribute("aria-expanded")) !== "true") {
    await selectedNoteSection.click();
  }
  await page.getByLabel("Note title").fill("Installation Instructions");
  await page.getByLabel("Note text").fill("Class I seal fitting required");
  await page.getByLabel("Leader arrow").check();
  await expect(page.getByTestId("canvas-note-leader-target")).toBeVisible();
  const noteLeaderTarget = page.getByTestId("canvas-note-leader-target");
  const noteLeaderTargetBox = await noteLeaderTarget.boundingBox();

  if (!noteLeaderTargetBox) {
    throw new Error("Expected note leader target to be visible.");
  }

  await page.mouse.move(
    noteLeaderTargetBox.x + noteLeaderTargetBox.width / 2,
    noteLeaderTargetBox.y + noteLeaderTargetBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    noteLeaderTargetBox.x + noteLeaderTargetBox.width / 2 + 35,
    noteLeaderTargetBox.y + noteLeaderTargetBox.height / 2 + 20
  );
  await page.mouse.up();
  const noteHit = page.getByTestId("canvas-note-hit").first();
  const noteXBeforeNudge = Number(await noteHit.getAttribute("x"));
  await noteHit.click();
  await page.keyboard.press("ArrowRight");
  expect(Number(await noteHit.getAttribute("x"))).toBeCloseTo(
    noteXBeforeNudge + 1,
    1
  );

  const zoomDisplay = page.getByTestId("drawing-zoom-display");
  await expect(zoomDisplay).toContainText(/%/);
  await page
    .getByRole("button", { name: "Set drawing zoom to 100 percent" })
    .click();
  await expect(zoomDisplay).toHaveText("100%");
  const sheetStage = page.getByTestId("drawing-sheet-stage");
  await expect(sheetStage).toBeVisible();
  const actualSizeBox = await sheetStage.boundingBox();
  const actualSizeTransform = await sheetStage.evaluate(
    (element) => (element as HTMLElement).style.transform
  );

  expect(actualSizeTransform).not.toContain("scale(");
  expect(actualSizeBox?.width ?? 0).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Fit drawing" }).click();
  const fitZoom = await zoomDisplay.textContent();
  const fitStageBox = await sheetStage.boundingBox();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(zoomDisplay).not.toHaveText(fitZoom ?? "");
  const zoomedStageBox = await sheetStage.boundingBox();
  const zoomedStageTransform = await sheetStage.evaluate(
    (element) => (element as HTMLElement).style.transform
  );

  expect(zoomedStageTransform).not.toContain("scale(");
  expect(zoomedStageBox?.width ?? 0).toBeGreaterThan(fitStageBox?.width ?? 0);
  await page.getByRole("button", { name: "Zoom out" }).click();

  const viewport = page.getByTestId("drawing-canvas-viewport");
  const viewportBox = await viewport.boundingBox();

  if (!viewportBox) {
    throw new Error("Expected drawing viewport to be visible.");
  }

  const centerViewportScroll = async () => {
    await viewport.evaluate((element) => {
      element.style.scrollBehavior = "auto";
      element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2);
      element.scrollTop = Math.max(0, (element.scrollHeight - element.clientHeight) / 2);
    });
  };

  const zoomAtVisiblePaperPoint = async (paperLocator: Locator) => {
    const beforePaperBox = await paperLocator.boundingBox();
    const currentViewportBox = await viewport.boundingBox();

    if (!beforePaperBox || !currentViewportBox) {
      throw new Error("Expected sheet paper to be visible for cursor zoom.");
    }

    const point = {
      x: Math.min(
        beforePaperBox.x + beforePaperBox.width - 40,
        Math.max(
          beforePaperBox.x + 40,
          currentViewportBox.x + currentViewportBox.width / 2
        )
      ),
      y: Math.min(
        beforePaperBox.y + beforePaperBox.height - 40,
        Math.max(
          beforePaperBox.y + 40,
          currentViewportBox.y + currentViewportBox.height / 2
        )
      )
    };
    const xRatio = (point.x - beforePaperBox.x) / beforePaperBox.width;
    const yRatio = (point.y - beforePaperBox.y) / beforePaperBox.height;
    const zoomBefore = await zoomDisplay.textContent();

    await viewport.dispatchEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -240,
      clientX: point.x,
      clientY: point.y
    });
    await expect(zoomDisplay).not.toHaveText(zoomBefore ?? "");
    await page.waitForTimeout(100);

    const afterPaperBox = await paperLocator.boundingBox();

    if (!afterPaperBox) {
      throw new Error("Expected sheet paper after cursor zoom.");
    }

    const anchoredPoint = {
      x: afterPaperBox.x + afterPaperBox.width * xRatio,
      y: afterPaperBox.y + afterPaperBox.height * yRatio
    };

    expect(Math.abs(anchoredPoint.x - point.x)).toBeLessThan(8);
    expect(Math.abs(anchoredPoint.y - point.y)).toBeLessThan(8);
  };

  await page
    .getByRole("button", { name: "Set drawing zoom to 100 percent" })
    .click();
  await expect(zoomDisplay).toHaveText("100%");
  await centerViewportScroll();
  await zoomAtVisiblePaperPoint(sheetStage.locator("[data-sheet-paper]"));
  await page.getByRole("button", { name: "Fit drawing" }).click();
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
    element.scrollTop = 0;
  });
  const panStartBox = await sheetStage.boundingBox();

  if (!panStartBox) {
    throw new Error("Expected active drawing sheet to be visible for panning.");
  }

  await page.mouse.move(
    panStartBox.x + panStartBox.width / 2,
    panStartBox.y + panStartBox.height / 2
  );
  await page.mouse.down({ button: "middle" });
  await expect(viewport).toHaveClass(/drawing-canvas-viewport-middle-panning/);
  await page.mouse.move(
    panStartBox.x + panStartBox.width / 2 - 80,
    panStartBox.y + panStartBox.height / 2 - 60
  );
  await page.mouse.up({ button: "middle" });
  await expect(viewport).not.toHaveClass(
    /drawing-canvas-viewport-middle-panning/
  );
  const scrollAfterMiddlePan = await viewport.evaluate((element) => ({
    left: element.scrollLeft,
    maxLeft: element.scrollWidth - element.clientWidth,
    maxTop: element.scrollHeight - element.clientHeight,
    top: element.scrollTop
  }));

  if (scrollAfterMiddlePan.maxLeft > 20) {
    expect(scrollAfterMiddlePan.left).toBeGreaterThan(20);
  }

  if (scrollAfterMiddlePan.maxTop > 20) {
    expect(scrollAfterMiddlePan.top).toBeGreaterThan(20);
  }

  expect(
    scrollAfterMiddlePan.left + scrollAfterMiddlePan.top
  ).toBeGreaterThan(20);

  const anchorHotspot = page.getByTestId("canvas-anchor-hotspot").last();
  await anchorHotspot.hover();
  await expect(page.getByTestId("canvas-anchor-tooltip")).toBeVisible();
  await expect(page.getByTestId("canvas-anchor-tooltip")).toContainText("Anchor");
  await expect(page.getByTestId("canvas-anchor-tooltip")).toContainText("Terminal");

  await page.getByRole("button", { name: "Fit drawing" }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.locator('[data-anchor-hotspot="nmt81:2"]').click();
  await expect(page.getByTestId("drawing-toast")).toHaveCount(0);
  const destinationAnchor = page.locator('[data-anchor-hotspot="clx1p:CH2_T2"]');
  const destinationBox = await destinationAnchor.boundingBox();

  if (!destinationBox) {
    throw new Error("Expected NRF81 ground anchor to be visible.");
  }

  await page.mouse.move(
    destinationBox.x + destinationBox.width / 2,
    destinationBox.y + destinationBox.height / 2
  );
  await expect(page.getByTestId("canvas-connection-preview")).toBeVisible();
  await destinationAnchor.click({ force: true });
  await expect(page.getByText("Connection added.")).toBeVisible();

  await page.getByRole("button", { name: /^Connection / }).click();
  const labelInput = page.getByRole("textbox", { name: "Label" });
  await labelInput.fill("Direct HART");
  await page.getByLabel("Cable assembly").selectOption({ label: "C-101" });
  await page.getByLabel("Conductor key").fill("direct_hart");
  await page.getByRole("button", { name: "Regenerate wire ID" }).click();
  await expect(page.getByRole("textbox", { name: "Wire ID" })).toHaveValue(
    "C-101-DIRECT-HART"
  );
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await page.getByRole("button", { name: "Browse connections" }).click();
  const updatedConnectionsDialog = page.getByRole("dialog", {
    name: "Connections"
  });
  await expect(
    updatedConnectionsDialog.getByTestId("drawing-connection-card")
  ).toHaveCount(5);
  const directHartConnection = updatedConnectionsDialog.getByRole("button", {
    name: /C-101-DIRECT-HART/
  });
  await expect(directHartConnection).toBeVisible();
  await directHartConnection.click();
  await expect(updatedConnectionsDialog).toHaveCount(0);
  const directHartConnectionSection = page.getByRole("button", {
    name: /^Connection /
  });
  await expect(directHartConnectionSection).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await directHartConnectionSection.click();
  await expect(page.getByTestId("canvas-connection-line").first()).toHaveAttribute(
    "d",
    /M/
  );
  const labelHandle = page.getByTestId("canvas-route-label-handle");
  await expect(labelHandle).toBeVisible();
  await expect(page.getByTestId("canvas-route-label-handle-layer")).toBeVisible();
  const labelHandleCursor = await labelHandle.evaluate(
    (element) => getComputedStyle(element).cursor
  );
  const labelHandleRendersAbovePlacements = await page.evaluate(() => {
    const handleLayer = document.querySelector(
      '[data-testid="canvas-route-label-handle-layer"]'
    );
    const placementHitbox = document.querySelector(
      'rect[data-placement-id="clx1p"]'
    );

    return Boolean(
      handleLayer &&
        placementHitbox &&
        (placementHitbox.compareDocumentPosition(handleLayer) &
          Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });

  expect(labelHandleCursor).toContain("data:image/svg+xml");
  expect(labelHandleRendersAbovePlacements).toBe(true);
  await expect(page.getByTestId("canvas-route-point").first()).toBeVisible();
  const routePoint = page.getByTestId("canvas-route-point").first();
  const routePointBox = await routePoint.boundingBox();

  if (!routePointBox) {
    throw new Error("Expected selected connection route point to be visible.");
  }

  await page.mouse.move(
    routePointBox.x + routePointBox.width / 2,
    routePointBox.y + routePointBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    routePointBox.x + routePointBox.width / 2 + 30,
    routePointBox.y + routePointBox.height / 2 + 20
  );
  await page.mouse.up();
  await routePoint.click({ force: true });
  const routePointCountBeforeDelete = await page
    .getByTestId("canvas-route-point")
    .count();
  await expect(page.getByTestId("canvas-route-point-delete")).toBeVisible();
  await page.getByTestId("canvas-route-point-delete").click();
  await expect(page.getByTestId("canvas-route-point-delete")).toHaveCount(0);
  expect(await page.getByTestId("canvas-route-point").count()).toBeLessThan(
    routePointCountBeforeDelete
  );
  await page.getByRole("button", { name: "Reset route" }).click();
  await expect(page.getByText("auto / orthogonal")).toBeVisible();
  await expect(page.getByTestId("canvas-connection-bundle")).toHaveCount(0);

  await page.locator('[data-anchor-hotspot="clx1p:CH1_T1"]').click();
  await expect(page.locator("rect[data-resize-handle]")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(page.locator("rect[data-resize-handle]")).toHaveCount(0);

  await addCableFromLibrary(page);
  await expect(page.getByRole("dialog", { name: "Add Symbol" })).toBeVisible();
  await expect(page.getByLabel("Asset tag")).toHaveValue("C-102");
  await page.getByRole("button", { name: "Place symbol" }).click();
  await expect(page.getByRole("dialog", { name: "Add Symbol" })).toHaveCount(0);
  const spareCablePlacement = page
    .locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id]')
    .last();
  const spareCableId = await spareCablePlacement.getAttribute("data-placement-id");

  if (!spareCableId) {
    throw new Error("Expected added spare cable placement to have an id.");
  }

  await expect(page.locator("rect[data-resize-handle]")).toHaveCount(4);
  const placementBoxBeforeMove = await spareCablePlacement.boundingBox();

  if (!placementBoxBeforeMove) {
    throw new Error("Expected selected spare cable placement to be visible.");
  }

  await page.mouse.move(
    placementBoxBeforeMove.x + placementBoxBeforeMove.width / 2,
    placementBoxBeforeMove.y + placementBoxBeforeMove.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    placementBoxBeforeMove.x + placementBoxBeforeMove.width / 2 + 60,
    placementBoxBeforeMove.y + placementBoxBeforeMove.height / 2 + 20
  );
  await page.mouse.up();
  const placementBoxAfterMove = await spareCablePlacement.boundingBox();

  expect(placementBoxAfterMove?.x ?? 0).toBeGreaterThan(
    placementBoxBeforeMove.x + 10
  );

  const beforeResizeBox = await spareCablePlacement.boundingBox();
  const resizeHandle = page.locator('rect[data-resize-handle="se"]');
  const resizeHandleBox = await resizeHandle.boundingBox();

  if (!resizeHandleBox || !beforeResizeBox) {
    throw new Error("Expected selected placement resize handle to be visible.");
  }

  await page.mouse.move(
    resizeHandleBox.x + resizeHandleBox.width / 2,
    resizeHandleBox.y + resizeHandleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    resizeHandleBox.x + resizeHandleBox.width / 2 + 50,
    resizeHandleBox.y + resizeHandleBox.height / 2 + 20
  );
  await page.mouse.up();
  const afterResizeBox = await spareCablePlacement.boundingBox();

  expect(afterResizeBox?.width ?? 0).toBeGreaterThan(beforeResizeBox.width);
  await expect(page.getByTestId("canvas-placement-rotation-label")).toContainText(
    "0\u00b0"
  );

  const rotateHandle = page.getByTestId("canvas-placement-rotate-handle");
  const rotateHandleBox = await rotateHandle.boundingBox();

  if (!rotateHandleBox || !afterResizeBox) {
    throw new Error("Expected selected placement rotate handle to be visible.");
  }

  await page.mouse.move(
    rotateHandleBox.x + rotateHandleBox.width / 2,
    rotateHandleBox.y + rotateHandleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    afterResizeBox.x + afterResizeBox.width + 24,
    afterResizeBox.y + afterResizeBox.height / 2
  );
  await page.mouse.up();
  await expect(page.getByTestId("canvas-placement-rotation-label")).toContainText(
    "90\u00b0"
  );

  await noteHit.click({ modifiers: ["Control"] });
  await expect(page.getByRole("button", { name: /^Selection/ })).toBeVisible();
  const placementHitboxes = page.locator(
    'svg[aria-label="Interactive drawing overlay"] rect[data-placement-id]'
  );
  const placementCountBeforePaste = await placementHitboxes.count();
  const noteCountBeforePaste = await page.getByTestId("canvas-note-hit").count();

  await page.keyboard.press("Control+C");
  await expect(page.getByText("Selection copied.")).toBeVisible();
  await page.keyboard.press("Control+V");
  await expect(page.getByText("Selection pasted.")).toBeVisible();
  await expect(placementHitboxes).toHaveCount(placementCountBeforePaste + 1);
  await expect(page.getByTestId("canvas-note-hit")).toHaveCount(
    noteCountBeforePaste + 1
  );
  await page.keyboard.press("Control+Z");
  await expect(page.getByText("Undo.")).toBeVisible();
  await expect(placementHitboxes).toHaveCount(placementCountBeforePaste);
  await expect(page.getByTestId("canvas-note-hit")).toHaveCount(
    noteCountBeforePaste
  );
  await page.keyboard.press("Control+Y");
  await expect(page.getByText("Redo.")).toBeVisible();
  await expect(placementHitboxes).toHaveCount(placementCountBeforePaste + 1);
  await page.keyboard.press("Control+Z");
  await expect(placementHitboxes).toHaveCount(placementCountBeforePaste);
  await spareCablePlacement.click();

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const drawingToast = page.getByTestId("drawing-toast");
  await expect(drawingToast).toBeVisible();
  await expect(drawingToast).toContainText("Drawing saved.");
  const toastBox = await drawingToast.boundingBox();
  const viewportBoxAfterSave = await viewport.boundingBox();

  if (!toastBox || !viewportBoxAfterSave) {
    throw new Error("Expected drawing toast and viewport to be visible.");
  }

  expect(toastBox.x).toBeGreaterThanOrEqual(viewportBoxAfterSave.x - 4);
  expect(toastBox.x).toBeLessThan(viewportBoxAfterSave.x + 80);
  expect(toastBox.y).toBeGreaterThanOrEqual(viewportBoxAfterSave.y - 48);
  expect(toastBox.y).toBeLessThan(viewportBoxAfterSave.y + 80);

  await page.reload();
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  await expect(page.getByText("Installation Instructions")).toBeVisible();
  await expect(page.getByText("Class I seal fitting required")).toBeVisible();
  await expect(page.getByTestId("canvas-note-hit")).toHaveCount(1);
  await page
    .locator(
      'svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="nmt81"]'
    )
    .click({ force: true });
  const reloadedAttributes = page.getByRole("button", {
    name: /Engineering Attributes/
  });
  await reloadedAttributes.click();
  const reloadedAttributeList = page.locator("[data-engineering-attributes]");
  await expect(reloadedAttributeList).toContainText(
    "Measure the tank's average temperature"
  );
  await expect(reloadedAttributeList).toContainText("24 V");
  await page.getByRole("button", { name: "Fit drawing" }).click();
  const reloadedSpareCablePlacement = page.locator(
    `svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="${spareCableId}"]`
  );
  const reloadedPlacementBox = await reloadedSpareCablePlacement.boundingBox();

  if (!reloadedPlacementBox) {
    throw new Error("Expected reloaded spare cable placement to be visible.");
  }

  await expect(reloadedSpareCablePlacement).toHaveAttribute(
    "transform",
    /rotate\(90/
  );
  expect(reloadedPlacementBox.x).toBeGreaterThan(
    placementBoxBeforeMove.x + 10
  );
  await page.locator(`[data-anchor-hotspot="${spareCableId}:CH1_T1"]`).click();
  await expect(page.getByTestId("canvas-placement-delete")).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(reloadedSpareCablePlacement).toHaveCount(0);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  await page.getByRole("button", { name: "Drawing Settings" }).click();
  const reloadedDrawingSettings = page.getByRole("dialog", {
    name: "Drawing Settings"
  });
  await expect(
    reloadedDrawingSettings
      .getByRole("group", { name: "Drawing settings measurement units" })
      .getByRole("button", { name: "in", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await reloadedDrawingSettings
    .getByRole("button", { name: "Cancel" })
    .click();
  await page.getByRole("button", { name: "Browse connections" }).click();
  const reloadedConnectionsDialog = page.getByRole("dialog", {
    name: "Connections"
  });
  const reloadedDirectHartConnection = reloadedConnectionsDialog.getByRole("button", {
    name: /C-101-DIRECT-HART/
  });
  await expect(reloadedDirectHartConnection).toBeVisible();
  await reloadedDirectHartConnection.click();
  await page.getByRole("button", { name: /^Connection / }).click();
  await page.getByRole("button", { name: "Delete connection" }).click();
  await page.getByRole("button", { name: "Browse connections" }).click();
  const connectionsAfterDelete = page.getByRole("dialog", {
    name: "Connections"
  });
  await expect(
    connectionsAfterDelete.getByRole("button", {
      name: /C-101-DIRECT-HART/
    })
  ).toHaveCount(0);
  await connectionsAfterDelete
    .getByRole("button", { name: "Close connections" })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

  await page.getByRole("button", { name: "Open sheet loader" }).click();
  await page
    .getByRole("dialog", { name: "Sheet Loader" })
    .getByRole("button", { name: "Add Sheet" })
    .click();
  await page.getByRole("dialog", { name: "Add Sheet" }).getByRole("button", {
    name: "Add sheet",
    exact: true
  }).click();
  await expect(page.getByTestId("drawing-sheet-frame")).toHaveCount(1);
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 2 of 2"
  );
  await page.getByRole("button", { name: "Edit active sheet" }).click();
  const sheetSettings = page.getByRole("dialog", {
    name: "Edit Active Sheet"
  });
  await expect(sheetSettings.getByLabel("Sheet name")).toHaveValue("Sheet 2");
  await sheetSettings.getByLabel("Sheet name").fill("Instrumentation");
  await sheetSettings
    .getByLabel("Description")
    .fill("Instrument detail and sheet 2 notes");
  await sheetSettings.getByRole("button", { name: "Apply" }).click();
  await expect(sheetSettings).toHaveCount(0);
  await expect(
    page.getByTestId("active-sheet-readout")
  ).toContainText("Instrumentation");
  await expect(page.getByTestId("drawing-sheet-frame")).toBeVisible();

  const sheetFrames = page.getByTestId("drawing-sheet-frame");
  await expect(
    sheetFrames.locator(".drawing-sheet-caption-name")
  ).toHaveText("Instrumentation");
  await expect(
    sheetFrames.getByText("Instrument detail and sheet 2 notes")
  ).toHaveCount(0);

  await activateSheet(page, "Wiring");
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 1 of 2"
  );
  await activateSheet(page, "Instrumentation");
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 2 of 2"
  );
  await page
    .getByRole("button", { name: "Set drawing zoom to 100 percent" })
    .click();
  await expect(zoomDisplay).toHaveText("100%");
  await centerViewportScroll();
  await zoomAtVisiblePaperPoint(sheetFrames.locator("[data-sheet-paper]"));
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 2 of 2"
  );
  await page.getByRole("button", { name: "Fit drawing" }).click();

  await addCableFromLibrary(page);
  await expect(page.getByRole("dialog", { name: "Add Symbol" })).toBeVisible();
  await expect(page.getByLabel("Asset tag")).toHaveValue("C-103");
  await page.getByRole("button", { name: "Place symbol" }).click();
  await expandInspectorSection(page, /Asset Identity/);
  await expect(page.getByRole("textbox", { name: "Tag" })).toHaveValue("C-103");

  await addSymbolFromLibrary(
    page,
    /Monitor 1/,
    "NRF81 Tank Side Monitor"
  );
  const referenceDialog = page.getByRole("dialog", { name: "Add Symbol" });
  await expect(referenceDialog).toBeVisible();
  await referenceDialog
    .getByRole("button", { name: /Reference existing Use/ })
    .click();
  await expect(referenceDialog.getByText("TSM-101")).toBeVisible();
  await page.getByRole("button", { name: "Place symbol" }).click();
  await expandInspectorSection(page, /Asset Identity/);
  await expect(page.getByRole("textbox", { name: "Tag" })).toHaveValue(
    "TSM-101"
  );
  await addNoteFromCanvas(page);
  await expandInspectorSection(page, /Selected Note/);
  await page.getByLabel("Note title").fill("Sheet 2 Note");
  await page.getByLabel("Note text").fill("Sheet 2 isolated content");
  await expect(
    sheetStage.getByText("Sheet 2 isolated content")
  ).toBeVisible();

  await activateSheet(page, "Wiring");
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 1 of 2"
  );
  await expect(sheetStage.getByText("Sheet 2 isolated content")).toHaveCount(0);
  await expect(page.getByText("Installation Instructions")).toBeVisible();
  await activateSheet(page, "Instrumentation");
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 2 of 2"
  );
  await expect(
    sheetStage.getByText("Sheet 2 isolated content")
  ).toBeVisible();

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 1 of 2"
  );
  await activateSheet(page, "Instrumentation");
  await page.getByRole("button", { name: "Edit active sheet" }).click();
  const reloadedSheetSettings = page.getByRole("dialog", {
    name: "Edit Active Sheet"
  });
  await expect(reloadedSheetSettings.getByLabel("Description")).toHaveValue(
    "Instrument detail and sheet 2 notes"
  );
  await reloadedSheetSettings
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(
    sheetStage.getByText("Sheet 2 isolated content")
  ).toBeVisible();

  const multiSheetPrintResponse = await page.request.get(
    `/drawings/${drawingId}/print`
  );
  expect(multiSheetPrintResponse.ok()).toBeTruthy();
  const multiSheetPrintHtml = await multiSheetPrintResponse.text();
  expect(multiSheetPrintHtml.match(/class="drawing-page"/g)).toHaveLength(2);
  expect(multiSheetPrintHtml).toContain("1 OF 2");
  expect(multiSheetPrintHtml).toContain("2 OF 2");

  await page
    .getByRole("button", { name: "Collapse symbol library panel" })
    .click();
  await expect(page.getByTestId("drawing-symbols-rail")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Expand symbol library panel" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand symbol library panel" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Symbol Library" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Expand Symbol Library" })
  ).toHaveAttribute("aria-expanded", "false");

  await page
    .getByRole("button", { name: "Collapse drawing properties panel" })
    .click();
  await expect(page.getByTestId("drawing-properties-rail")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Expand drawing properties panel" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand drawing properties panel" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Properties" })
  ).toBeVisible();

  await page.goto("/drawings");
  const drawingLink = page.locator(`a[href="/drawings/${drawingId}"]`);
  await expect(drawingLink).toBeVisible();
  await drawingLink
    .locator("xpath=ancestor::tr")
    .getByRole("button", { name: /Delete/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Delete drawing" })).toBeVisible();
  await expect(page.getByText("This action cannot be undone.")).toBeVisible();
  await page.getByRole("button", { name: "Delete drawing", exact: true }).click();
  await expect(drawingLink).toHaveCount(0);
});
