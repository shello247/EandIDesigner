import { expect, test } from "@playwright/test";

test("creates, saves, reloads, and edits the NMT81 to NRF81 sample drawing", async ({
  page
}) => {
  test.setTimeout(90000);

  await page.goto("/drawings/new");

  await expect(
    page.getByRole("heading", { name: "NMT81 to NRF81 Sample" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Create NMT81 to NRF81 sample" })
    .click();

  await expect(page.getByRole("heading", { name: "Drawing Sheet" })).toBeVisible({
    timeout: 15000
  });
  const drawingId = new URL(page.url()).pathname.split("/").pop();

  if (!drawingId) {
    throw new Error("Expected drawing id in URL after sample drawing creation.");
  }

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

  await viewport.dispatchEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY: -240,
    clientX: viewportBox.x + viewportBox.width / 2,
    clientY: viewportBox.y + viewportBox.height / 2
  });
  await expect(zoomDisplay).not.toHaveText(fitZoom ?? "");

  const beforeMiddlePanTransform = await sheetStage.evaluate(
    (element) => (element as HTMLElement).style.transform
  );
  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2,
    viewportBox.y + viewportBox.height / 2
  );
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2 + 70,
    viewportBox.y + viewportBox.height / 2 + 40
  );
  await page.mouse.up({ button: "middle" });
  const afterMiddlePanTransform = await sheetStage.evaluate(
    (element) => (element as HTMLElement).style.transform
  );

  expect(afterMiddlePanTransform).not.toBe(beforeMiddlePanTransform);

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

  await page
    .getByRole("button", { name: "CLX Cable 1 Pair clx_cable_1_pair" })
    .click();
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

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Drawing Sheet" })).toBeVisible();
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

  expect(reloadedPlacementBox.x).toBeGreaterThan(
    placementBoxBeforeMove.x + 10
  );
  await page.locator(`[data-anchor-hotspot="${spareCableId}:CH1_T1"]`).click();
  await expect(page.getByTestId("canvas-placement-delete")).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(reloadedSpareCablePlacement).toHaveCount(0);

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Drawing Sheet" })).toBeVisible();
  await page.getByRole("button", { name: "TT-101 ↔ C-101" }).click();
  const reloadedDirectHartConnection = page.getByRole("button", {
    name: /C-101-DIRECT-HART/
  });
  await expect(reloadedDirectHartConnection).toBeVisible();
  await reloadedDirectHartConnection.click();
  await page.getByRole("button", { name: "Delete connection" }).click();
  await expect(reloadedDirectHartConnection).toHaveCount(0);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

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
