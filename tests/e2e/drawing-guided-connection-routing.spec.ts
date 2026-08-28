import { expect, test } from "./drawing-test";
import { createE2eNmt81ToNrf81Drawing } from "./drawing-fixtures";

test.describe.configure({ mode: "serial" });

test("authors and preserves a guided orthogonal connection route", async ({
  page
}) => {
  test.setTimeout(90000);

  const drawingId = await createE2eNmt81ToNrf81Drawing();
  await page.goto(`/drawings/${drawingId}`);
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
    timeout: 15000
  });
  await page.getByRole("button", { name: "Fit drawing" }).click();

  const connectionLines = page.getByTestId("canvas-connection-line");
  await expect(connectionLines).toHaveCount(4);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.locator('[data-anchor-hotspot="nmt81:2"]').click();
  await expect(page.getByTestId("drawing-toast")).toHaveCount(0);

  const overlay = page.locator('svg[aria-label="Interactive drawing overlay"]');
  const overlayBox = await overlay.boundingBox();
  if (!overlayBox) throw new Error("Expected the drawing overlay to be visible.");

  const clickSheetPoint = async (xRatio: number, yRatio: number) => {
    await page.mouse.click(
      overlayBox.x + overlayBox.width * xRatio,
      overlayBox.y + overlayBox.height * yRatio
    );
  };

  await clickSheetPoint(0.34, 0.43);
  await expect(page.getByTestId("canvas-guided-connection-waypoint")).toHaveCount(
    1
  );
  await page.keyboard.press("Backspace");
  await expect(page.getByTestId("canvas-guided-connection-waypoint")).toHaveCount(
    0
  );

  await clickSheetPoint(0.34, 0.43);
  await clickSheetPoint(0.67, 0.56);
  await expect(page.getByTestId("canvas-guided-connection-waypoint")).toHaveCount(
    2
  );

  const destination = page.locator(
    '[data-anchor-hotspot="clx1p:CH2_T2"]'
  );
  await destination.hover();
  const preview = page.getByTestId("canvas-connection-preview");
  await expect(preview).toBeVisible();
  const previewPath = await preview.getAttribute("d");
  expect(previewPath).toBeTruthy();

  await destination.click({ force: true });
  await expect(page.getByTestId("drawing-toast")).toContainText(
    "Connection added."
  );
  await expect(connectionLines).toHaveCount(5);
  const committedPath = await connectionLines.last().getAttribute("d");
  expect(committedPath).toBe(previewPath);
  await expect(page.getByTestId("canvas-guided-connection-preview")).toHaveCount(
    0
  );

  await page.keyboard.press("Control+z");
  await expect(connectionLines).toHaveCount(4);
  await page.keyboard.press("Control+y");
  await expect(connectionLines).toHaveCount(5);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
  await page.reload();
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
    timeout: 15000
  });
  await expect(page.getByTestId("canvas-connection-line")).toHaveCount(5);
  await expect(page.getByTestId("canvas-connection-line").last()).toHaveAttribute(
    "d",
    committedPath ?? ""
  );
});
