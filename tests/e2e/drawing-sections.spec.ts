import { expect, test } from "./drawing-test";
import {
  createE2eSectionedDrawingPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("deletes the first front-matter sheet from the Sheet Loader", async ({
  page
}) => {
  const drawingId = await createE2eSectionedDrawingPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
    await page.getByRole("button", { name: "Open sheet loader" }).click();

    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    const collapsedGroups = loader.getByRole("button", { name: /^Expand / });
    await expect(collapsedGroups).toHaveCount(3);
    await expect(collapsedGroups.first()).toHaveAttribute("aria-expanded", "false");
    await loader.getByRole("button", { name: "Expand Front Matter" }).click();
    const coverRow = loader.getByRole("row").filter({ hasText: "Package Cover" });
    await coverRow
      .getByRole("button", { name: "Actions for Package Cover" })
      .click();
    await coverRow.getByRole("menuitem", { name: "Delete" }).click();

    const confirmation = page.getByRole("dialog", { name: "Delete sheet" });
    await expect(confirmation).toContainText("Sheet 1 of 6");
    await confirmation
      .getByRole("button", { name: "Delete sheet", exact: true })
      .click();

    await expect(loader.getByText("Package Cover", { exact: true })).toHaveCount(0);
    await expect(loader.getByText("Front Matter", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await expect(
      page.getByRole("dialog", { name: "Sheet Loader" }).getByText("Package Cover", {
        exact: true
      })
    ).toHaveCount(0);
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});

test("organizes drawing package sections without duplicating numbers or deleting members", async ({
  page
}) => {
  const drawingId = await createE2eSectionedDrawingPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
    await page.getByRole("button", { name: "Open sheet loader" }).click();

    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    await expect(loader.getByText("Front Matter", { exact: true })).toBeVisible();
    await expect(loader.getByText("Section 1", { exact: true })).toBeVisible();
    await expect(loader.getByText("Section 2", { exact: true })).toBeVisible();

    await loader.getByRole("button", { name: "Move Section 2 first" }).click();
    await expect(
      loader.getByRole("row").filter({ hasText: "Section 1" }).filter({
        hasText: "Panel Drawings"
      })
    ).toBeVisible();
    await expect(
      loader.getByRole("row").filter({ hasText: "Section 2" }).filter({
        hasText: "Field Drawings"
      })
    ).toBeVisible();

    const search = loader.getByPlaceholder(
      "Search by section, sheet number, name, type, or description"
    );
    await search.fill("Panel Layout 1");
    const panelLayoutRow = loader.getByRole("row", {
      name: /Panel Layout 1 Drawing/
    });
    await panelLayoutRow
      .getByRole("button", { name: "Actions for Panel Layout 1" })
      .click();
    await panelLayoutRow
      .getByRole("menuitem", { name: "Move to another section" })
      .click();

    const moveDialog = page.getByRole("dialog", {
      name: "Move sheet to section"
    });
    await moveDialog
      .getByLabel("Destination")
      .selectOption({ label: "Section 2 - Field Drawings" });
    await moveDialog
      .getByRole("button", { name: "Move sheet", exact: true })
      .click();
    await expect(
      loader.getByRole("row").filter({ hasText: "Section 2" }).filter({
        hasText: "Field Drawings"
      })
    ).toBeVisible();
    await expect(loader.getByRole("row", { name: /Panel Layout 1 Drawing/ })).toBeVisible();

    await search.fill("");
    const fieldSectionHeader = loader
      .getByRole("row")
      .filter({ hasText: "Section 2" })
      .filter({ hasText: "Field Drawings" });
    await fieldSectionHeader.getByRole("button", { name: "Load title" }).click();

    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const sectionLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    const activeSectionHeader = sectionLoader
      .getByRole("row")
      .filter({ hasText: "Section 2" })
      .filter({ hasText: "Field Drawings" });
    await activeSectionHeader
      .getByRole("button", { name: "Actions for Field Drawings" })
      .click();
    await activeSectionHeader.getByRole("menuitem", { name: "Delete" }).click();
    const deleteDialog = page.getByRole("dialog", {
      name: "Remove section divider"
    });
    await expect(deleteDialog).toContainText("3 member sheets");
    await expect(deleteDialog).toContainText("Section 1");
    await deleteDialog.getByRole("button", { name: "Remove divider" }).click();

    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const reloadedLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    await expect(reloadedLoader.getByText("Section 2", { exact: true })).toHaveCount(0);
    await reloadedLoader
      .getByPlaceholder(
        "Search by section, sheet number, name, type, or description"
      )
      .fill("Field Loop 1");
    await expect(reloadedLoader.getByText("Section 1", { exact: true })).toBeVisible();
    await expect(reloadedLoader.getByText("Field Loop 1", { exact: true })).toBeVisible();
    await reloadedLoader.getByRole("button", { name: "Close sheet loader" }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
    await page.reload();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByRole("menuitem", { name: /Package Preview/ }).click();

    await page
      .getByTestId("drawing-package-preview-page")
      .nth(1)
      .scrollIntoViewIfNeeded();
    const sectionTitle = page.locator('[data-section-title-page="true"]');
    await expect(sectionTitle).toContainText("SECTION 1");
    await expect(sectionTitle).not.toContainText("SECTION 99");

    const pdfResponse = await page.request.get(`/drawings/${drawingId}/pdf`);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
