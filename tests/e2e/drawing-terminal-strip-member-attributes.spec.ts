import { expect, test, type Page } from "./drawing-test";
import {
  createE2eTerminalBlockGroupPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";

async function addMemberAttribute(
  page: Page,
  definitionKey: string,
  label: string,
  value: string
) {
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
    .selectOption(definitionKey);
  await attributeDialog.getByLabel(label, { exact: true }).fill(value);
  await attributeDialog
    .getByRole("button", { name: "Add attribute", exact: true })
    .click();
}

test("edits and projects terminal-strip member engineering attributes", async ({
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
    await builder.getByLabel("Name").fill("Member attribute strip");
    await builder
      .getByRole("button", { name: "Edit M02 specifications" })
      .click();

    await addMemberAttribute(
      page,
      "engineering_purpose",
      "Purpose / Description",
      "Incoming tank alarm supply"
    );
    await addMemberAttribute(page, "nominal_voltage", "Nominal voltage", "24");

    const memberSpecifications = page.getByRole("dialog", {
      name: /M02 · Terminal 1/
    });
    await expect(memberSpecifications).toContainText("2 recorded");
    await memberSpecifications.getByRole("button", { name: "Done" }).click();
    await builder
      .getByRole("button", { name: "Create terminal strip" })
      .click();
    await expect(builder).toHaveCount(0);

    const terminalStripCard = page.getByRole("button", {
      name: /^Terminal Strip TB-101/
    });
    await terminalStripCard.click();
    const memberTable = page.getByRole("table", {
      name: "Terminal strip member specifications"
    });
    await expect(
      memberTable.getByRole("row", {
        name: /1 M02 .*Incoming tank alarm supply 2/
      })
    ).toBeVisible();

    const hotspot = page.locator('[data-anchor-hotspot$=":M02.left"]').first();
    await hotspot.focus();
    await expect(page.getByTestId("canvas-anchor-tooltip")).toContainText(
      "Incoming tank alarm supply"
    );

    await page.getByRole("button", { name: "Edit terminal strip" }).click();
    const editBuilder = page.getByRole("dialog", {
      name: "Terminal Strip Builder"
    });
    await editBuilder.getByRole("button", { name: "Move M02 down" }).click();
    await editBuilder.getByRole("button", { name: "Apply changes" }).click();
    await expect(editBuilder).toHaveCount(0);
    await expect(
      memberTable.getByRole("row", {
        name: /2 M02 .*Incoming tank alarm supply 2/
      })
    ).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await expect(page.locator('[data-anchor-hotspot$=":M02.left"]')).toHaveCount(1);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
    await deleteE2eSymbol(fixture.endBracketSymbolId);
  }
});
