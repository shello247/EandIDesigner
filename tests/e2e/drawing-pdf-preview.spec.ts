import { expect, test } from "@playwright/test";
import {
  createE2eNmt81ToNrf81Drawing,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("opens the PDF preview in a separate browser tab", async ({ page }) => {
  test.setTimeout(60000);

  const drawingId = await createE2eNmt81ToNrf81Drawing();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const previewPdfLink = page.getByRole("menuitem", {
      name: /Preview PDF/
    });

    await expect(previewPdfLink).toHaveAttribute(
      "href",
      `/drawings/${drawingId}/pdf`
    );
    await expect(previewPdfLink).toHaveAttribute("target", "_blank");
    await expect(previewPdfLink).toHaveAttribute("rel", /noopener/);

    const popupPromise = page.waitForEvent("popup");
    await previewPdfLink.click();
    const pdfPage = await popupPromise;
    await expect(page).toHaveURL(new RegExp(`/drawings/${drawingId}$`));

    const pdfResponse = await page.request.get(`/drawings/${drawingId}/pdf`);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    expect(pdfResponse.headers()["content-disposition"]).toContain("inline");
    await pdfPage.close();
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
