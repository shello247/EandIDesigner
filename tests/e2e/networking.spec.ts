import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";

test("creates and exports an industrial network map package", async ({ page }) => {
  test.setTimeout(90000);

  const runId = Date.now().toString();
  const title = `E2E Network Map ${runId}`;
  const mapKey = `e2e_network_map_${runId}`;
  let networkMapId: string | undefined;

  try {
    await page.goto("/networking");

    await expect(
      page.getByRole("heading", { name: "Networking", exact: true })
    ).toBeVisible();
    await expect(page.getByText("dedicated canvas workspace")).toBeVisible();

    await page.getByRole("link", { name: "New network map" }).click();
    await expect(
      page.getByRole("heading", { name: "New Network Map", exact: true })
    ).toBeVisible();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Map key").fill(mapKey);
    await page.getByRole("button", { name: "Create network map" }).click();

    await expect(
      page.getByRole("heading", { name: title, exact: true })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Network Library" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Network Properties" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Network Assets" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add note" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
    await expect(page.getByTestId("network-map-viewport")).toBeVisible();
    await expect(page.getByTestId("network-map-sheet-frame")).toHaveCount(1);
    await expect(page.getByTestId("network-map-paper")).toBeVisible();
    await expect(page.getByText("Plant Firewall")).toHaveCount(0);
    await expect(page.getByText("Control Network Switch")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Set network map zoom to 100 percent" })
      .click();
    await expect(page.getByTestId("network-zoom-display")).toHaveText("100%");
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByTestId("network-zoom-display")).not.toHaveText("100%");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByTestId("network-map-toast")).toContainText(
      "Note added."
    );
    await expect(page.getByRole("heading", { name: "Selected Note" })).toBeVisible();
    await page.getByLabel("Note text").fill("Network note from e2e");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("network-map-toast")).toContainText(
      "Network map saved."
    );

    const url = new URL(page.url());
    networkMapId = url.pathname.split("/").filter(Boolean).at(-1);

    if (!networkMapId) {
      throw new Error("Expected network map id in detail URL.");
    }

    const printResponse = await page.request.get(
      `/networking/${networkMapId}/print`
    );
    expect(printResponse.ok()).toBeTruthy();
    const printHtml = await printResponse.text();
    expect(printHtml).toContain("window.print()");
    expect(printHtml).toContain("Back to network map");
    expect(printHtml).toContain('data-network-title-block="true"');
    expect(printHtml).not.toContain('data-network-node-id="');

    const pdfResponse = await page.request.get(`/networking/${networkMapId}/pdf`);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe("%PDF");

    await page.goto("/networking");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  } finally {
    const cleanupFilters: Array<{ id?: string; mapKey?: string }> = [{ mapKey }];

    if (networkMapId) {
      cleanupFilters.push({ id: networkMapId });
    }

    await prisma.networkMap.deleteMany({
      where: {
        OR: cleanupFilters
      }
    });
  }
});
