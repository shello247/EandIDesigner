import { expect, test, type Page } from "./drawing-test";
import {
  createE2eDrawingGuidesDrawing,
  deleteE2eDrawing
} from "./drawing-fixtures";

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

test("creates session guides and snaps placement bounds without persisting them", async ({
  page
}) => {
  test.setTimeout(90000);
  let drawingId: string | undefined;

  try {
    const fixture = await createE2eDrawingGuidesDrawing();
    drawingId = fixture.drawingId;
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });
    const showGuides = page.getByRole("button", {
      name: "Show drawing guides"
    });
    await expect(showGuides).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("drawing-horizontal-ruler")).toHaveCount(0);
    await showGuides.click();
    await page
      .getByRole("button", { name: "Set drawing zoom to 100 percent" })
      .click();

    const activeFrame = page.getByTestId("drawing-sheet-frame");
    const ruler = activeFrame.getByTestId("drawing-horizontal-ruler");
    const paper = activeFrame.locator("[data-sheet-paper]");
    const caption = page.locator(".drawing-sheet-caption");
    const rulerBox = await ruler.boundingBox();
    const paperBox = await paper.boundingBox();
    const captionBox = await caption.boundingBox();

    if (!rulerBox || !paperBox || !captionBox) {
      throw new Error("Expected drawing caption, ruler, and paper bounds.");
    }

    expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(rulerBox.y);

    await ruler.hover({ position: { x: 100, y: rulerBox.height / 2 } });
    await page.mouse.down();
    await expect(page.getByTestId("drawing-guide")).toHaveCount(1);
    const dropPaperBox = await paper.boundingBox();
    if (!dropPaperBox) {
      throw new Error("Expected drawing paper bounds during guide drag.");
    }
    await page.mouse.move(dropPaperBox.x + 100, dropPaperBox.y + 160, {
      steps: 10
    });
    await expect(page.getByTestId("drawing-guide")).toHaveCount(1);
    await page.mouse.up();

    const guide = page.getByTestId("drawing-guide");
    await expect(guide).toHaveCount(1);
    await expect(guide).toHaveAttribute("data-guide-axis", "horizontal");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    const guidePosition = Number(await guide.getAttribute("data-guide-position"));
    const placement = page.locator(
      `svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="${fixture.placementId}"]`
    );
    const placementBox = await placement.boundingBox();
    const placementTop = Number(await placement.getAttribute("y"));

    if (!placementBox) {
      throw new Error("Expected guide test placement bounds.");
    }

    const nearGuideTop = guidePosition - 1.5;
    const dragDeltaPixels = (nearGuideTop - placementTop) * 2;
    await page.mouse.move(
      placementBox.x + placementBox.width / 2,
      placementBox.y + placementBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      placementBox.x + placementBox.width / 2,
      placementBox.y + placementBox.height / 2 + dragDeltaPixels
    );
    await page.mouse.up();

    await expect
      .poll(async () => Number(await placement.getAttribute("y")))
      .toBeCloseTo(guidePosition, 1);

    await activateSheet(page, fixture.secondarySheetName);
    await expect(page.getByTestId("drawing-guide")).toHaveCount(0);
    await activateSheet(page, fixture.primarySheetName);
    await expect(page.getByTestId("drawing-guide")).toHaveCount(1);

    await page.reload();
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
    await expect(page.getByTestId("drawing-guide")).toHaveCount(0);
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});

test("rulers create guides and the toolbar toggles their visibility", async ({
  page
}) => {
  test.setTimeout(90000);
  let drawingId: string | undefined;

  try {
    const fixture = await createE2eDrawingGuidesDrawing();
    drawingId = fixture.drawingId;
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });
    const showGuides = page.getByRole("button", {
      name: "Show drawing guides"
    });
    await expect(showGuides).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("drawing-horizontal-ruler")).toHaveCount(0);
    await showGuides.click();

    const activeFrame = page.getByTestId("drawing-sheet-frame");
    const ruler = activeFrame.getByTestId("drawing-vertical-ruler");
    const paper = activeFrame.locator("[data-sheet-paper]");
    const rulerBox = await ruler.boundingBox();
    const paperBox = await paper.boundingBox();
    if (!rulerBox || !paperBox) {
      throw new Error("Expected vertical ruler and paper bounds.");
    }
    await ruler.hover({ position: { x: rulerBox.width / 2, y: 100 } });
    await page.mouse.down();
    await expect(page.getByTestId("drawing-guide")).toHaveCount(1);
    const dropPaperBox = await paper.boundingBox();
    if (!dropPaperBox) {
      throw new Error("Expected drawing paper bounds during guide drag.");
    }
    await page.mouse.move(dropPaperBox.x + 160, dropPaperBox.y + 100, {
      steps: 10
    });
    await page.mouse.up();
    await expect(page.getByTestId("drawing-guide")).toHaveCount(1);
    await expect(page.getByTestId("drawing-guide")).toHaveAttribute(
      "data-guide-axis",
      "vertical"
    );

    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("button", { name: "Hide drawing guides" }).click();
    await expect(page.getByTestId("drawing-guides-overlay")).toHaveCount(0);
    await expect(page.getByTestId("drawing-horizontal-ruler")).toHaveCount(0);

    await page.getByRole("button", { name: "Show drawing guides" }).click();
    await expect(page.getByTestId("drawing-guide")).toHaveCount(1);
    await expect(page.getByTestId("drawing-horizontal-ruler")).toHaveCount(1);
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
