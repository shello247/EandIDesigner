import { expect, test } from "@playwright/test";
import {
  createE2ePanelComponentPackage,
  deleteE2eDrawing,
  deleteE2eSymbol,
} from "./drawing-fixtures";
import {
  ensureWireCatalogConfigured,
  openPanelEngineeringWorkbench,
  selectPanelEngineeringView,
} from "./panel-workflow-helpers";

test.describe.configure({ mode: "serial" });

test("completes the JB001 Detailed Panel controlled-pilot workflow", async ({
  page,
}) => {
  const fixture = await createE2ePanelComponentPackage();

  try {
    await test.step("load the Detailed Panel sheet and discover source data", async () => {
      await page.goto(`/drawings/${fixture.drawingId}`);
      await page.getByRole("button", { name: "Open sheet loader" }).click();
      await page
        .getByRole("dialog", { name: "Sheet Loader" })
        .getByRole("row", {
          name: /JB001 Detailed Panel Drawing Detailed Panel/,
        })
        .getByRole("button", { name: "Load" })
        .click();
      const queue = await openPanelEngineeringWorkbench(page);
      await expect(queue.getByRole("row", { name: /TB-101/ })).toContainText(
        "Available",
      );
      await selectPanelEngineeringView(queue, "External Terminations");
      await expect(
        queue.getByRole("row", { name: /C-101-P1-WHT/ }),
      ).toContainText("Sheet 1");
    });

    await test.step("map the unresolved field termination and place existing assets", async () => {
      const queue = page.getByRole("dialog", {
        name: "Panel Engineering Workbench",
      });
      const unmapped = queue.getByRole("row", { name: /C-101-P2-BLK/ });
      await unmapped.getByRole("button", { name: "Map", exact: true }).click();
      const mapping = page.getByRole("dialog", {
        name: "Map External Termination",
      });
      await mapping
        .getByRole("radio", { name: /Terminal 2\/ external/ })
        .check();
      await mapping.getByRole("button", { name: "Apply mapping" }).click();
      await mapping.getByRole("button", { name: "Done" }).click();
      await selectPanelEngineeringView(queue, "Equipment");
      await queue
        .getByRole("row", { name: /TB-101/ })
        .getByRole("button", { name: "Add", exact: true })
        .click();
      await queue
        .getByRole("row", { name: /MCB-101/ })
        .getByRole("button", { name: "Add", exact: true })
        .click();
      await queue.getByRole("button", { name: "Close", exact: true }).click();
    });

    await test.step("author an internal wire", async () => {
      await page.getByRole("button", { name: "Wire", exact: true }).click();
      await page.locator('[data-anchor-hotspot$=":T1_TOP"]').click();
      await page.locator('[data-anchor-hotspot$=":LINE"]').click();
      const wireDialog = page.getByRole("dialog", {
        name: "Create internal wire",
      });
      await ensureWireCatalogConfigured(page, wireDialog);
      await wireDialog.getByRole("button", { name: "Create wire" }).click();
      await expect(page.getByTestId("drawing-toast")).toContainText(
        "TB-101:T1(001) added",
      );
    });

    await test.step("author a structured jumper", async () => {
      await page.getByRole("button", { name: "Pattern", exact: true }).click();
      const authoring = page.getByLabel("Connection pattern authoring");
      await authoring
        .getByLabel("Pattern type")
        .selectOption("terminal_jumper");
      await authoring.getByLabel("Electrical domain").selectOption("signal");
      await authoring.getByRole("button", { name: "Select terminals" }).click();
      await page.locator('[data-anchor-hotspot$=":T2_TOP"]').click();
      await page.locator('[data-anchor-hotspot$=":LOAD"]').click();
      await authoring.getByRole("button", { name: "Review" }).click();
      await page
        .getByRole("dialog", { name: "Review connection pattern" })
        .getByRole("button", { name: "Create pattern" })
        .click();
      await expect(page.getByTestId("drawing-toast")).toContainText(
        "JMP-001 added",
      );
    });

    await test.step("save and approve structured connectivity without a standalone review action", async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByTestId("drawing-toast")).toContainText(
        "Drawing saved",
      );
      await expect(page.getByRole("button", { name: /Panel Review/, includeHidden: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByTestId("drawing-toast")).toContainText(
        /approved/i,
      );
    });

    await test.step("generate deliverables and review the package", async () => {
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await page.getByRole("menuitem", { name: /Panel Deliverables/ }).click();
      const deliverables = page.getByRole("dialog", {
        name: "Panel Engineering Deliverables",
      });
      await expect(deliverables).toContainText("TB-101");
      await expect(deliverables).toContainText("TB-101:T1(001)");
      await deliverables.getByRole("button", { name: "Close" }).click();
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await page.getByRole("menuitem", { name: /Package Preview/ }).click();
      await expect(page.getByTestId("drawing-package-preview")).toBeVisible();
      await page.getByRole("button", { name: "Exit preview" }).first().click();
      const pdf = await page.request.get(`/drawings/${fixture.drawingId}/pdf`);
      expect(pdf.ok()).toBe(true);
      expect(pdf.headers()["content-type"]).toContain("application/pdf");
    });

    await test.step("reload without duplicate physical identities", async () => {
      await page.reload();
      await page.getByRole("button", { name: "Asset Manager" }).click();
      const manager = page.getByRole("dialog", { name: "Asset Manager" });
      await expect(
        manager.getByRole("button", { name: /^MCB-101 / }),
      ).toHaveCount(1);
      await expect(
        manager.getByRole("button", { name: /^TB-101 / }),
      ).toHaveCount(1);
      await expect(manager).not.toContainText("Connection Pattern Legend");
    });
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
