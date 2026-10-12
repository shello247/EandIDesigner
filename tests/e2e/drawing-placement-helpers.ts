import { expect, type Page } from "./drawing-test";

/** Confirms a pending insertion on the paper, never on an application control. */
export async function confirmCanvasPlacement(page: Page, point?: { x: number; y: number }, finish = true, ctrlKey = false) {
  const paper = page.locator('[data-sheet-paper="true"]');
  await page.getByRole("button", { name: "Fit drawing", exact: true }).click();
  const frame = page.getByTestId("drawing-sheet-frame");
  const width = Number(await frame.getAttribute("data-sheet-width"));
  const height = Number(await frame.getAttribute("data-sheet-height"));
  const box = await paper.boundingBox();
  if (!box) throw new Error("Drawing paper is unavailable.");
  const screen = { x: box.x + (point?.x ?? width / 2) / width * box.width, y: box.y + (point?.y ?? height / 2) / height * box.height };
  const session = page.getByTestId("placement-session");
  const kind = await session.getAttribute("data-target-kind");
  if (!point && kind !== "sheet") {
    const id = await session.getAttribute("data-configured-target-id");
    const selector = id ? `[data-placement-id="${id}"]` : kind === "panel" ? '[data-panel-enclosure="true"]'
      : kind === "connection-view" ? '[data-panel-connection-view="true"]' : '[data-backplane="true"]';
    const container = page.locator(`.drawing-sheet-rendered ${selector}`);
    await expect(container).toHaveCount(1); // Ambiguous fixtures must supply a point.
    const bounds = await container.boundingBox();
    if (bounds) { screen.x = bounds.x + bounds.width / 2; screen.y = bounds.y + bounds.height / 2; }
  }
  await page.mouse.move(screen.x, screen.y);
  await expect(page.getByTestId("placement-ghost")).toHaveAttribute("data-valid", "true");
  if (ctrlKey) await page.keyboard.down("Control");
  try { await page.mouse.click(screen.x, screen.y); }
  finally { if (ctrlKey) await page.keyboard.up("Control"); }
  if (finish && await page.getByTestId("placement-session").count()) {
    await page.keyboard.press("Escape");
  }
}
