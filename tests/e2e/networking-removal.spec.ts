import { expect, test } from "@playwright/test";

const retiredRoutes = [
  "/networking",
  "/networking/new",
  "/networking/retired-map",
  "/networking/retired-map/print",
  "/networking/retired-map/pdf",
  "/symbols/network-assets/retired-version"
];

test("retired networking routes return 404", async ({ request }) => {
  for (const route of retiredRoutes) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(404);
  }
});

test("primary navigation no longer advertises Networking", async ({ page }) => {
  await page.goto("/symbols");

  await expect(page.getByRole("link", { name: "Networking" })).toHaveCount(0);
  await expect(page.locator('a[href^="/networking"]')).toHaveCount(0);
});
