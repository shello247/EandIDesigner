import { expect, test } from "@playwright/test";
import {
  createE2ePanelComponentPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";
import { openDetailedPanelWorkflow } from "./panel-workflow-helpers";

test.describe.configure({ mode: "serial" });

test("completes the JB001 Detailed Panel controlled-pilot workflow", async ({
  page
}) => {
  const fixture = await createE2ePanelComponentPackage();

  try {
    await test.step("load the Detailed Panel sheet and discover source data", async () => {
      await page.goto(`/drawings/${fixture.drawingId}`);
      await page.getByRole("button", { name: "Open sheet loader" }).click();
      await page
        .getByRole("dialog", { name: "Sheet Loader" })
        .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
        .getByRole("button", { name: "Load" })
        .click();
      const queue = await openDetailedPanelWorkflow(page, "advanced");
      await expect(queue.getByRole("row", { name: /TB-101/ })).toContainText(
        "Available"
      );
      await queue.getByRole("tab", { name: /External Terminations/ }).click();
      await expect(queue.getByRole("row", { name: /C-101-P1-WHT/ })).toContainText(
        "Sheet 1"
      );
    });

    await test.step("map the unresolved field termination and place existing assets", async () => {
      const queue = page.getByRole("dialog", {
        name: "Detailed Panel Workflow"
      });
      const unmapped = queue.getByRole("row", { name: /C-101-P2-BLK/ });
      await unmapped.getByRole("button", { name: "Map", exact: true }).click();
      const mapping = page.getByRole("dialog", {
        name: "Map External Termination"
      });
      await mapping.getByRole("radio", { name: /Terminal 2\/ external/ }).check();
      await mapping.getByRole("button", { name: "Apply mapping" }).click();
      await mapping.getByRole("button", { name: "Done" }).click();
      await queue.getByRole("tab", { name: /Associated Assets/ }).click();
      await queue
        .getByRole("row", { name: /TB-101/ })
        .getByRole("button", { name: "Place" })
        .click();
      await queue
        .getByRole("row", { name: /MCB-101/ })
        .getByRole("button", { name: "Place" })
        .click();
      await queue.getByRole("button", { name: "Close", exact: true }).click();
    });

    await test.step("author an internal wire", async () => {
      await page.getByRole("button", { name: "Wire", exact: true }).click();
      await page.locator('[data-anchor-hotspot$=":T1_TOP"]').click();
      await page.locator('[data-anchor-hotspot$=":LINE"]').click();
      await page
        .getByRole("dialog", { name: "Create internal wire" })
        .getByRole("button", { name: "Create wire" })
        .click();
      await expect(page.getByTestId("drawing-toast")).toContainText(
        "JB001-W001 added"
      );
    });

    await test.step("author a structured jumper", async () => {
      await page.getByRole("button", { name: "Pattern", exact: true }).click();
      const authoring = page.getByLabel("Connection pattern authoring");
      await authoring.getByLabel("Pattern type").selectOption("terminal_jumper");
      await authoring.getByLabel("Electrical domain").selectOption("signal");
      await authoring.getByRole("button", { name: "Select terminals" }).click();
      await page.locator('[data-anchor-hotspot$=":T2_TOP"]').click();
      await page.locator('[data-anchor-hotspot$=":LOAD"]').click();
      await authoring.getByRole("button", { name: "Review" }).click();
      await page
        .getByRole("dialog", { name: "Review connection pattern" })
        .getByRole("button", { name: "Create pattern" })
        .click();
      await expect(page.getByTestId("drawing-toast")).toContainText("JMP-001 added");
    });

    await test.step("save, review, and approve structured connectivity", async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved");
      await page.getByRole("button", { name: /Panel Review/ }).click();
      const review = page.getByRole("dialog", {
        name: "JB001 Panel Drawing Review"
      });
      const blockingSummary = review
        .locator("p")
        .filter({ hasText: /^Blocking errors$/ })
        .locator("..");
      const blockingText = await blockingSummary.innerText();
      expect(
        blockingText,
        await review.locator("tbody").innerText()
      ).toContain("0");
      await review.getByRole("button", { name: "Close panel review" }).click();
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByTestId("drawing-toast")).toContainText(/approved/i);
    });

    await test.step("generate deliverables and review the package", async () => {
      await page.getByRole("button", { name: "Deliverables" }).click();
      const deliverables = page.getByRole("dialog", {
        name: "Panel Engineering Deliverables"
      });
      await expect(deliverables).toContainText("TB-101");
      await expect(deliverables).toContainText("JB001-W001");
      await deliverables.getByRole("button", { name: "Close" }).click();
      await page.getByRole("button", { name: "Package Preview" }).click();
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
        manager.getByRole("button", { name: /^MCB-101 / })
      ).toHaveCount(1);
      await expect(
        manager.getByRole("button", { name: /^TB-101 / })
      ).toHaveCount(1);
      await expect(manager).not.toContainText("Connection Pattern Legend");
    });
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
