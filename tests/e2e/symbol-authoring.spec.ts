import { expect, test } from "@playwright/test";

const validSvg = `
<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="100" height="50" fill="white" stroke="black"/>
  <circle id="terminal:1" cx="24" cy="42" r="2"/>
  <circle data-name="terminal:2" cx="54" cy="42" r="2"/>
  <rect id="anchor:GND" x="90" y="56" width="4" height="4"/>
</svg>`;

test("imports an SVG symbol draft and keeps review workflows available", async ({
  page
}) => {
  const runId = Date.now().toString();
  const symbolName = `Imported SVG Device ${runId}`;
  const symbolKey = `imported_svg_device_${runId}`;
  const noteText = `Reviewed imported SVG terminal section ${runId}.`;

  await page.goto("/symbols/new");

  await expect(
    page.getByRole("heading", { name: "SVG Import", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate" })).toHaveCount(0);
  await expect(page.locator("#device-image")).toHaveCount(0);

  await page.setInputFiles("#svg-file", {
    name: "test-device.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(validSvg)
  });
  await expect(page.getByText("SVG imported.")).toBeVisible();
  await expect(page.getByText("Detected anchors")).toBeVisible();

  await page.getByLabel("Display name").fill(symbolName);
  await page.getByLabel("Symbol key").fill(symbolKey);
  await page.getByLabel("Manufacturer").fill("Test Vendor");
  await page.getByLabel("Model").fill("SVG-100");
  await page.getByLabel("Terminal function 1").fill("Signal positive");
  await page.getByLabel("Terminal function 2").fill("Signal negative");
  await page
    .getByRole("button", { name: "Save imported symbol" })
    .click();

  await expect(
    page.getByRole("heading", { name: symbolName, exact: true })
  ).toBeVisible();
  await expect(page.getByText("Needs review")).toBeVisible();

  await page.locator('[data-terminal-hotspot="1"]').hover();
  await expect(page.locator('[data-terminal-tooltip="1"]')).toContainText(
    "Terminal 1"
  );
  await expect(page.locator('[data-terminal-tooltip="1"]')).toContainText(
    "Signal positive"
  );

  await page.getByRole("button", { name: "Edit terminal map" }).click();
  await page.getByLabel("Function for terminal 1").fill("Verified signal positive");
  await page.getByRole("button", { name: "Save terminal map" }).click();
  await expect(page.getByText("Terminal map updated.")).toBeVisible();
  await expect(page.getByText("Verified signal positive")).toBeVisible();

  await expect(page.getByRole("button", { name: "AI verify" })).toBeEnabled();
  await page.getByRole("button", { name: "AI verify" }).click();
  await expect(page.getByText("AI terminal-map review complete.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI terminal-map review" })
  ).toBeVisible();

  await page.getByRole("tab", { name: "Engineer Notes" }).click();
  await page.getByLabel("Notes").fill(noteText);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Engineer note saved.")).toBeVisible();
  await expect(page.getByText(noteText)).toBeVisible();

  await page.getByRole("tab", { name: "Documents" }).click();
  await page.getByLabel("Document title").fill("Installation Manual");
  await page.setInputFiles("#document-file", {
    name: "installation-manual.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nstream\n"),
      Buffer.alloc(1_250_000, 32),
      Buffer.from("\nendstream\nendobj\ntrailer\n<<>>\n%%EOF")
    ])
  });
  await page.getByRole("button", { name: "Upload document" }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();
  await expect(page.getByText("Installation Manual")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
});

test("blocks invalid SVG import before save", async ({ page }) => {
  await page.goto("/symbols/new");

  await page.setInputFiles("#svg-file", {
    name: "invalid-device.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  });

  await expect(page.getByText("SVG root must define a viewBox.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save imported symbol" })
  ).toBeDisabled();
});
