import type { Locator, Page } from "@playwright/test";

export type PanelEngineeringView =
  | "Equipment"
  | "External Terminations"
  | "Terminal Map"
  | "Internal Wires"
  | "Connection Patterns";

export async function openPanelEngineeringWorkbench(
  page: Page,
): Promise<Locator> {
  await page
    .getByRole("button", { name: "Panel equipment", exact: true })
    .click();

  return page.getByRole("dialog", {
    name: "Panel Engineering Workbench",
  });
}

export async function selectPanelEngineeringView(
  workbench: Locator,
  view: PanelEngineeringView,
): Promise<void> {
  await workbench.getByLabel(/More panel engineering options/).click();
  await workbench.getByRole("menuitemradio", { name: view }).click();
}

export async function ensureWireCatalogConfigured(
  page: Page,
  scope: Locator,
): Promise<void> {
  const picker = scope.getByLabel("Wire specification");
  if ((await picker.locator("option").count()) > 1) {
    return;
  }

  await scope.getByRole("button", { name: "Manage Wire Catalog" }).click();
  const manager = page.getByRole("dialog", { name: "Wire Catalog" });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await manager.getByLabel("Name").fill(`E2E Blue 1.5 ${suffix}`);
  await manager.getByLabel("Wire type").fill("H07V-K");
  await manager.getByLabel("Size").fill("1.5 mm²");
  await manager.getByLabel("Color").fill("Blue");
  await manager.getByRole("button", { name: "Create specification" }).click();
  await manager.getByRole("button", { name: "Close Wire Catalog" }).click();
  await picker.selectOption({ index: 1 });
}
