import type { Locator, Page } from "@playwright/test";

export async function openDetailedPanelWorkflow(
  page: Page,
  mode: "guided" | "advanced" = "guided"
): Promise<Locator> {
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();

  const workflow = page.getByRole("dialog", {
    name: "Detailed Panel Workflow"
  });

  if (mode === "advanced") {
    await workflow
      .getByRole("button", { name: "Advanced Workbench", exact: true })
      .click();
  }

  return workflow;
}
