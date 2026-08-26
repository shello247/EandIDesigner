import { expect, test } from "@playwright/test";
import {
  createE2eTerminalBlockGroupPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";

test("copies a structured strip and places a shared representation", async ({
  page
}) => {
  const fixture = await createE2eTerminalBlockGroupPackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page
      .getByRole("button", { name: "Expand Symbol Library" })
      .click();
    await page.getByRole("button", { name: /^Panel Layout/ }).click();
    await page
      .getByRole("button", { name: "Terminal Strip", exact: true })
      .click();
    const builder = page.getByRole("dialog", {
      name: "Terminal Strip Builder"
    });
    await builder.getByLabel("Name").fill("Reusable terminal strip");
    await builder
      .getByRole("button", { name: "Edit M02 specifications" })
      .click();
    const memberSpecifications = page.getByRole("dialog", {
      name: /M02 · Terminal 1/
    });
    await memberSpecifications
      .getByRole("button", { name: "Add attribute" })
      .click();
    const attributeDialog = page.getByRole("dialog", {
      name: "Add engineering attribute"
    });
    await attributeDialog
      .getByLabel("Add engineering attribute")
      .selectOption("engineering_purpose");
    await attributeDialog
      .getByLabel("Purpose / Description")
      .fill("Incoming 24 VDC supply");
    await attributeDialog
      .getByRole("button", { name: "Add attribute", exact: true })
      .click();
    await memberSpecifications.getByRole("button", { name: "Done" }).click();
    await builder
      .getByRole("button", { name: "Create terminal strip" })
      .click();
    await expect(builder).toHaveCount(0);

    const sourceProperties = page.getByRole("button", {
      name: /^Terminal Strip TB-101/
    });
    await sourceProperties.click();
    await expect(sourceProperties).toHaveAttribute("aria-expanded", "true");
    const terminalDescriptions = page.getByRole("table", {
      name: "Terminal strip member specifications"
    });
    await expect(
      terminalDescriptions.getByRole("row", {
        name: /1 M02 .*Incoming 24 VDC supply 1/
      })
    ).toBeVisible();
    await expect(
      terminalDescriptions.getByRole("row", {
        name: /2 M03 .*No purpose recorded 0/
      })
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Reuse terminal strip" })
      .click();
    const reuse = page.getByRole("dialog", { name: "Reuse terminal strip" });
    await expect(reuse).toContainText("TB-101");
    await expect(
      reuse.getByRole("button", { name: /Copy as new terminal strip/ })
    ).toHaveAttribute("aria-pressed", "true");
    await reuse.getByLabel("Destination sheet").selectOption({
      label: "Sheet 3 — Terminal Strip Reuse Drawing"
    });
    await reuse.getByLabel("Destination mount").selectOption("");
    await reuse
      .getByRole("button", { name: "Copy terminal strip" })
      .click();

    await expect(reuse).toHaveCount(0);
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "TB-102 created as an independent terminal strip"
    );
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);

    const copiedProperties = page.getByRole("button", {
      name: /^Terminal Strip TB-102/
    });
    await expect(async () => {
      if ((await copiedProperties.getAttribute("aria-expanded")) !== "true") {
        await copiedProperties.click();
      }
      await expect(copiedProperties).toHaveAttribute("aria-expanded", "true");
    }).toPass();
    await page
      .getByRole("button", { name: "Reuse terminal strip" })
      .click();
    const representation = page.getByRole("dialog", {
      name: "Reuse terminal strip"
    });
    await representation
      .getByRole("button", { name: /Place another representation/ })
      .click();
    await representation.getByLabel("Destination sheet").selectOption({
      label: "Sheet 1 — JB001 Panel Layout Drawing"
    });
    await representation.getByLabel("Destination mount").selectOption("");
    await representation
      .getByRole("button", { name: "Place representation" })
      .click();

    await expect(representation).toHaveCount(0);
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "TB-102 representation placed"
    );
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(14);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(14);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
    await deleteE2eSymbol(fixture.endBracketSymbolId);
  }
});
