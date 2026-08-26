import { expect, test } from "./drawing-test";
import { createE2eNmt81ToNrf81Drawing } from "./drawing-fixtures";

test.describe.configure({ mode: "serial" });

test("keeps edits made while a save acknowledgment is in flight dirty", async ({
  page
}) => {
  test.setTimeout(90000);

  const drawingId = await createE2eNmt81ToNrf81Drawing();
  await page.goto(`/drawings/${drawingId}`);
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  await page.getByRole("button", { name: "Fit drawing" }).click();

  const placement = page.locator(
    'svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="nmt81"]'
  );
  await placement.click({ force: true });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();

  let releaseAcknowledgment!: () => void;
  const acknowledgmentRelease = new Promise<void>((resolve) => {
    releaseAcknowledgment = resolve;
  });
  let signalPersisted!: () => void;
  const persisted = new Promise<void>((resolve) => {
    signalPersisted = resolve;
  });
  let holdFirstSave = true;

  await page.route(`**/drawings/${drawingId}`, async (route) => {
    if (route.request().method() !== "POST" || !holdFirstSave) {
      await route.continue();
      return;
    }

    holdFirstSave = false;
    const response = await route.fetch();
    signalPersisted();
    await acknowledgmentRelease;
    await route.fulfill({ response });
  });

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await persisted;
  await expect(page.getByRole("button", { name: "Saving drawing" })).toBeVisible();

  await page.getByTestId("drawing-canvas-viewport").focus();
  await page.keyboard.press("ArrowRight");
  releaseAcknowledgment();
  await expect(page.getByText("Drawing saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saving drawing" })).toHaveCount(0);

  const saveAgain = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveAgain).toBeEnabled();
  await saveAgain.click();
  await expect(page.getByRole("button", { name: "Drawing saved" })).toBeVisible();
});
