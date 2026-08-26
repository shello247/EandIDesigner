import { expect, test } from "@playwright/test";
import {
  createE2ePanelComponentPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";
import { openPanelEngineeringWorkbench } from "./panel-workflow-helpers";

test("references and reloads panel equipment defined before Detailed Panel wiring", async ({
  page
}) => {
  test.setTimeout(60_000);
  const fixture = await createE2ePanelComponentPackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const sheetLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    const expandFrontMatter = sheetLoader.getByRole("button", {
      name: "Expand Front Matter"
    });
    if (await expandFrontMatter.count()) {
      await expandFrontMatter.click();
    }
    await sheetLoader
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const queue = await openPanelEngineeringWorkbench(page);
    const breakerRow = queue.getByRole("row", { name: /MCB-101/ });
    await expect(breakerRow).toContainText("Available");
    await breakerRow.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByTestId("drawing-toast")).toContainText(
      "MCB-101 placed"
    );
    await expect(breakerRow).toContainText("Represented");
    await queue.getByRole("button", { name: "Close", exact: true }).click();
    const properties = page.getByLabel("Drawing properties", { exact: true });
    const propertySections = properties.locator(
      "section.tool-panel:not(.drawing-object-inspector-header)"
    );
    const propertySectionCount = await propertySections.count();
    expect(propertySectionCount).toBeGreaterThan(0);
    for (let index = 0; index < propertySectionCount; index += 1) {
      const disclosure = propertySections
        .nth(index)
        .locator(":scope > button[aria-expanded]");
      await expect(disclosure).toHaveCount(1);
      await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    }
    const panelComponentSection = properties.getByRole("button", {
      name: /^Panel Component/
    });
    await panelComponentSection.click();
    await expect(page.getByText("Terminals (2)")).toBeVisible();
    await expect(
      page.getByText(
        "Physical dimensions are missing; physical panel-layout placement is unavailable.",
        { exact: true }
      )
    ).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const reloadedSheetLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    const reloadedExpandFrontMatter = reloadedSheetLoader.getByRole("button", {
      name: "Expand Front Matter"
    });
    if (await reloadedExpandFrontMatter.count()) {
      await reloadedExpandFrontMatter.click();
    }
    await reloadedSheetLoader
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();
    await page.getByRole("button", { name: "Asset Manager" }).click();
    const manager = page.getByRole("dialog", { name: "Asset Manager" });
    const managerTitle = manager.getByRole("heading", {
      name: "Asset Manager",
      exact: true
    });
    const createAsset = manager.getByRole("button", { name: "Create asset" });
    const managerTitleBox = await managerTitle.boundingBox();
    const createAssetBox = await createAsset.boundingBox();
    expect(managerTitleBox).not.toBeNull();
    expect(createAssetBox).not.toBeNull();
    if (!managerTitleBox || !createAssetBox) {
      throw new Error("Asset Manager header controls are not visible.");
    }
    expect(createAssetBox.width).toBeGreaterThanOrEqual(22);
    expect(createAssetBox.width).toBeLessThanOrEqual(25);
    expect(createAssetBox.height).toBe(createAssetBox.width);
    expect(createAssetBox.x - (managerTitleBox.x + managerTitleBox.width)).toBeLessThanOrEqual(12);
    await expect(createAsset).toHaveAttribute("title", "Create asset");
    await expect(createAsset).not.toContainText("Create asset");
    await expect(
      manager.getByText(
        "Create and manage package assets, engineering data, and sheet associations.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      manager.getByRole("heading", { name: "Select an asset" })
    ).toBeVisible();
    await expect(manager.getByRole("textbox", { name: "Tag" })).toHaveCount(0);
    const assetCategories = manager.getByRole("group", {
      name: "Asset categories"
    });
    const breakerCategory = assetCategories.getByRole("button", {
      name: /Breakers.*1 asset/
    });
    await expect(breakerCategory).toHaveAttribute("title", "Breakers");
    await expect(breakerCategory).not.toContainText("Breakers");
    await breakerCategory.click();
    await expect(manager).toContainText("MCB-101");
    const managedBreaker = manager.getByRole("button", { name: /^MCB-101 / });
    await expect(managedBreaker).toHaveCount(1);
    await managedBreaker.click();
    await expect(
      manager.getByRole("heading", { name: "MCB-101", exact: true })
    ).toBeVisible();
    const identitySection = manager.getByRole("button", {
      name: /^1 Identity/
    });
    const engineeringAttributesSection = manager.getByRole("button", {
      name: /^2 Engineering Attributes/
    });
    const sheetAssociationsSection = manager.getByRole("button", {
      name: /^3 Sheet Associations/
    });
    await expect(identitySection).toHaveAttribute("aria-expanded", "false");
    await expect(engineeringAttributesSection).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(sheetAssociationsSection).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(manager.getByRole("textbox", { name: "Tag" })).toHaveCount(0);

    await identitySection.click();
    await expect(manager.getByRole("textbox", { name: "Tag" })).toBeVisible();
    await identitySection.click();
    await engineeringAttributesSection.click();
    await expect(
      manager.getByText("No engineering attributes recorded.")
    ).toBeVisible();
    await engineeringAttributesSection.click();
    await sheetAssociationsSection.click();
    await expect(sheetAssociationsSection).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const loadAssociatedSheet = manager
      .getByRole("button", { name: /^Load Sheet / })
      .first();
    await expect(loadAssociatedSheet).toBeVisible();
    await loadAssociatedSheet.click();
    await expect(manager).toHaveCount(0);
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Sheet loaded."
    );

    await page.getByRole("button", { name: "Asset Manager" }).click();
    await breakerCategory.click();
    await managedBreaker.click();

    await createAsset.click();
    await expect(
      manager.getByRole("heading", { name: "Create asset", exact: true })
    ).toBeVisible();
    await manager.getByRole("textbox", { name: "Tag" }).fill("E2E-ASSET-101");
    await manager
      .getByRole("textbox", { name: "Title" })
      .fill("Created Asset Selection Check");
    await manager
      .getByRole("button", { name: "Create asset", exact: true })
      .last()
      .click();
    await expect(
      manager.getByRole("heading", { name: "E2E-ASSET-101", exact: true })
    ).toBeVisible();
    await expect(identitySection).toHaveAttribute("aria-expanded", "false");
    await expect(engineeringAttributesSection).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(sheetAssociationsSection).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(
      manager.getByRole("button", { name: /^E2E-ASSET-101 / })
    ).toHaveCount(1);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
