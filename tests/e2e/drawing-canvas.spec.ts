import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createE2eNmt81ToNrf81Drawing,
  deleteE2eDrawing
} from "./drawing-fixtures";

test.describe.configure({ mode: "serial" });

async function openSymbolDialog(
  page: Page,
  symbolName: string,
  categoryName: RegExp
) {
  const symbolButton = page.getByRole("button", {
    name: symbolName,
    exact: true
  });

  if (!(await symbolButton.isVisible())) {
    await page.getByRole("button", { name: categoryName }).click();
    await expect(symbolButton).toBeVisible();
  }

  await symbolButton.click();
}

async function loadSheet(page: Page, sheetName: RegExp) {
  await page.getByRole("button", { name: "Open sheet loader" }).click();
  await page
    .getByRole("dialog", { name: "Sheet Loader" })
    .getByRole("row", { name: sheetName })
    .getByRole("button", { name: "Load" })
    .click();
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
  await expect(page.getByTestId("drawing-connection-card")).toHaveCount(4);
  await expect(page.getByTestId("drawing-connection-group")).toHaveCount(2);
  await expect(page.getByText("TT-101 ↔ C-101")).toBeVisible();
  await expect(page.getByText("C-101 ↔ TSM-101")).toBeVisible();
  await expect(page.getByRole("button", { name: /C-101-BLK/ })).toHaveCount(0);
  await page.getByRole("button", { name: "TT-101 ↔ C-101" }).click();
  await expect(page.getByRole("button", { name: /C-101-BLK/ })).toBeVisible();
  await page.getByRole("button", { name: "TT-101 ↔ C-101" }).click();
  await expect(page.getByRole("button", { name: /C-101-BLK/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Selected Placement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Auto-route all" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show route handles" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export SVG" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview PDF" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: /Title Block/ })).toBeVisible();
  await expect(page.getByLabel("Client")).toBeHidden();
  await page.getByRole("button", { name: /Title Block/ }).click();
  await expect(page.getByLabel("Client")).toBeVisible();
  await page.getByLabel("Client").fill("Enermach");
  await page.getByLabel("Project / process").fill("Tank Automation");
  await page.getByLabel("Drawing number").fill("EI-001");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByRole("button", { name: /Selected Note/ })).toBeVisible();
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
  await expect(page.getByText("Select a destination anchor.")).toBeVisible();
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
  await expect(page.getByTestId("drawing-connection-card")).toHaveCount(5);

  const labelInput = page.getByRole("textbox", { name: "Label" });
  await labelInput.fill("Direct HART");
  await page.getByLabel("Cable assembly").selectOption({ label: "C-101" });
  await page.getByLabel("Conductor key").fill("direct_hart");
  await page.getByRole("button", { name: "Regenerate wire ID" }).click();
  await expect(page.getByRole("textbox", { name: "Wire ID" })).toHaveValue(
    "C-101-DIRECT-HART"
  );
  const directHartConnection = page.getByRole("button", {
    name: /C-101-DIRECT-HART/
  });
  await expect(
    directHartConnection
  ).toBeVisible();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  if (!(await directHartConnection.isVisible())) {
    await page.getByRole("button", { name: "TT-101 ↔ C-101" }).click();
  }
  await expect(directHartConnection).toBeVisible();
  await directHartConnection.click();
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
  if (!(await page.getByRole("button", { name: "Reset route" }).isVisible())) {
    await directHartConnection.click();
  }
  await page.getByRole("button", { name: "Reset route" }).click();
  await expect(page.getByText("auto / orthogonal")).toBeVisible();
  await expect(page.getByTestId("canvas-connection-bundle")).toHaveCount(0);

  await page.locator('[data-anchor-hotspot="clx1p:CH1_T1"]').click();
  await expect(page.locator("rect[data-resize-handle]")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(page.locator("rect[data-resize-handle]")).toHaveCount(0);

  await openSymbolDialog(
    page,
    "CLX Cable 1 Pair",
    /^Cable Assemblies \d+$/
  );
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
  await expect(page.getByRole("heading", { name: "Selection" })).toBeVisible();
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
  await page.getByRole("button", { name: "TT-101 ↔ C-101" }).click();
  const reloadedDirectHartConnection = page.getByRole("button", {
    name: /C-101-DIRECT-HART/
  });
  await expect(reloadedDirectHartConnection).toBeVisible();
  await reloadedDirectHartConnection.click();
  await page.getByRole("button", { name: "Delete connection" }).click();
  await expect(reloadedDirectHartConnection).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

  await page.getByRole("button", { name: "Add to drawing" }).click();
  await page.getByRole("menuitem", { name: /Sheet/ }).click();
  await page.getByRole("dialog", { name: "Add Sheet" }).getByRole("button", {
    name: "Add sheet",
    exact: true
  }).click();
  await expect(page.getByTestId("drawing-sheet-frame")).toHaveCount(1);
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 2 of 2"
  );
  await expect(page.getByLabel("Sheet name")).toHaveValue("Sheet 2");
  await page.getByLabel("Sheet name").fill("Instrumentation");
  await page
    .getByLabel("Description")
    .fill("Instrument detail and sheet 2 notes");
  await expect(
    page.getByTestId("active-sheet-readout")
  ).toContainText("Instrumentation");
  await expect(page.getByTestId("drawing-sheet-frame")).toBeVisible();
  await expect(page.getByLabel("Description")).toHaveValue(
    "Instrument detail and sheet 2 notes"
  );

  const activeSheetFrame = page.getByTestId("drawing-sheet-frame");
  await expect(
    activeSheetFrame.locator(".drawing-sheet-caption-name")
  ).toHaveText("Instrumentation");
  await expect(
    activeSheetFrame.getByText("Instrument detail and sheet 2 notes")
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: "Set drawing zoom to 100 percent" })
    .click();
  await expect(zoomDisplay).toHaveText("100%");
  await centerViewportScroll();
  await zoomAtVisiblePaperPoint(activeSheetFrame.locator("[data-sheet-paper]"));
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 2 of 2"
  );
  await page.getByRole("button", { name: "Fit drawing" }).click();

  await openSymbolDialog(
    page,
    "CLX Cable 1 Pair",
    /^Cable Assemblies \d+$/
  );
  await expect(page.getByRole("dialog", { name: "Add Symbol" })).toBeVisible();
  await expect(page.getByLabel("Asset tag")).toHaveValue("C-103");
  await page.getByRole("button", { name: "Place symbol" }).click();
  await expect(page.getByRole("textbox", { name: "Tag" })).toHaveValue("C-103");

  await openSymbolDialog(
    page,
    "NRF81 Tank Side Monitor",
    /^Controllers \d+$/
  );
  const referenceDialog = page.getByRole("dialog", { name: "Add Symbol" });
  await expect(referenceDialog).toBeVisible();
  await referenceDialog
    .getByRole("button", {
      name: /^Reference existing Use the same physical asset\.$/
    })
    .click();
  await expect(referenceDialog.getByText("TSM-101")).toBeVisible();
  await page.getByRole("button", { name: "Place symbol" }).click();
  await expect(page.getByRole("textbox", { name: "Tag" })).toHaveValue(
    "TSM-101"
  );
  await page.getByRole("button", { name: "Add note" }).click();
  await page.getByLabel("Note title").fill("Sheet 2 Note");
  await page.getByLabel("Note text").fill("Sheet 2 isolated content");
  await expect(
    sheetStage.getByText("Sheet 2 isolated content")
  ).toBeVisible();

  await loadSheet(page, /Wiring/);
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 1 of 2"
  );
  await expect(sheetStage.getByText("Sheet 2 isolated content")).toHaveCount(0);
  await expect(page.getByText("Installation Instructions")).toBeVisible();
  await loadSheet(page, /Instrumentation/);
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
  await loadSheet(page, /Instrumentation/);
  await expect(page.getByLabel("Description")).toHaveValue(
    "Instrument detail and sheet 2 notes"
  );
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
    page.getByRole("heading", { name: "Drawing Properties" })
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

test("saves and imports a drawing sheet template with asset resolution", async ({
  page
}) => {
  test.setTimeout(90000);

  const drawingId = await createE2eNmt81ToNrf81Drawing();
  await page.goto(`/drawings/${drawingId}`);
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
    timeout: 15000
  });

  const templateName = `Tank Wiring Template ${Date.now()}`;

  await page.getByRole("button", { name: "Save active sheet as template" }).click();
  await expect(
    page.getByRole("dialog", { name: "Save Sheet as Template" })
  ).toBeVisible();
  await page.getByLabel("Template name").fill(templateName);
  const saveTemplateDialog = page.getByRole("dialog", {
    name: "Save Sheet as Template"
  });

  await saveTemplateDialog
    .getByLabel("Description")
    .fill("Reusable NMT81 to NRF81 wiring sheet");
  await page.getByLabel("Keywords").fill("tank, wiring, template");
  await saveTemplateDialog
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByText("Sheet template saved.")).toBeVisible();

  await page.getByRole("button", { name: "Add sheet from template" }).click();
  await expect(
    page.getByRole("dialog", { name: "Add Sheet from Template" })
  ).toBeVisible();
  await page.getByRole("button", { name: `Use template ${templateName}` }).click();
  await expect(page.getByText("Resolve template assets")).toBeVisible();
  await expect(page.getByLabel("New tag for C-101")).toHaveValue("C-102");
  await expect(page.getByLabel("Resolution for TSM-101")).toHaveValue(
    "reference"
  );
  await expect(page.getByLabel("Existing asset for TSM-101")).toContainText(
    "TSM-101"
  );
  await page.getByRole("button", { name: "Import template" }).click();
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 2 of 2"
  );
  await expect(
    page.getByTestId("drawing-sheet-frame").getByText("C-102").first()
  ).toBeVisible();
  await expect(
    page.getByTestId("drawing-sheet-frame").getByText("TSM-101").first()
  ).toBeVisible();

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  await loadSheet(page, /Wiring 2/);
  await expect(page.getByTestId("active-sheet-readout")).toContainText(
    "Sheet 2 of 2"
  );
  await expect(
    page.getByTestId("drawing-sheet-frame").getByText("C-102").first()
  ).toBeVisible();

  const printResponse = await page.request.get(`/drawings/${drawingId}/print`);
  expect(printResponse.ok()).toBeTruthy();
  const printHtml = await printResponse.text();
  expect(printHtml.match(/class="drawing-page"/g)).toHaveLength(2);
  expect(printHtml).toContain("1 OF 2");
  expect(printHtml).toContain("2 OF 2");

  await deleteE2eDrawing(drawingId);
});
