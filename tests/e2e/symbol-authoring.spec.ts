import { expect, test, type Page } from "@playwright/test";

const validSvg = `
<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="100" height="50" fill="white" stroke="black"/>
  <circle id="terminal:1" cx="24" cy="42" r="2"/>
  <circle data-name="terminal:2" cx="54" cy="42" r="2"/>
  <rect id="anchor:GND" x="90" y="56" width="4" height="4"/>
</svg>`;

const portraitSvg = `
<svg viewBox="-2 5 42 143" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="9" width="30" height="135" fill="white" stroke="black"/>
  <circle id="terminal:3.1" cx="19.5" cy="53.5" r="0.5"/>
  <circle id="terminal:3.2" cx="19.5" cy="57.5" r="0.5"/>
</svg>`;

const componentPositionSvg = `
<svg viewBox="0 0 40 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="5" width="30" height="90" fill="white" stroke="black"/>
  <circle id="terminal:A1" cx="10" cy="84" r="1"/>
  <g id="Components">
    <g id="Position 1">
      <g id="Component: Relay">
        <rect id="Position Box" x="8" y="20" width="24" height="42"/>
      </g>
    </g>
  </g>
</svg>`;

async function expectAlignedCoordinateStage(page: Page) {
  const stage = page.locator('[data-testid="svg-coordinate-stage"]');
  const artwork = page.locator('[data-testid="svg-coordinate-artwork"]');
  const overlay = page.locator('[data-testid="svg-coordinate-overlay"]');
  const [stageBox, artworkBox, overlayBox] = await Promise.all([
    stage.boundingBox(),
    artwork.boundingBox(),
    overlay.boundingBox()
  ]);

  expect(stageBox).not.toBeNull();
  expect(artworkBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  expect(stageBox!.width).toBeLessThanOrEqual(620.5);
  expect(stageBox!.height).toBeLessThanOrEqual(620.5);
  expect(Math.abs(artworkBox!.x - overlayBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(artworkBox!.y - overlayBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(artworkBox!.width - overlayBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(artworkBox!.height - overlayBox!.height)).toBeLessThanOrEqual(1);

  return { stage, artwork, overlay };
}

async function expectEighteenPixelMarker(page: Page, selector: string) {
  const markerBox = await page.locator(selector).boundingBox();
  expect(markerBox).not.toBeNull();
  expect(markerBox!.width).toBeGreaterThanOrEqual(17);
  expect(markerBox!.width).toBeLessThanOrEqual(20);
  expect(markerBox!.height).toBeGreaterThanOrEqual(17);
  expect(markerBox!.height).toBeLessThanOrEqual(20);
  return markerBox!;
}

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
  await expectAlignedCoordinateStage(page);
  const importMarkerBox = await expectEighteenPixelMarker(
    page,
    '[data-import-anchor-marker="1"]'
  );

  await page.mouse.move(
    importMarkerBox.x + importMarkerBox.width / 2,
    importMarkerBox.y + importMarkerBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    importMarkerBox.x + importMarkerBox.width / 2 + 18,
    importMarkerBox.y + importMarkerBox.height / 2 + 9
  );
  await page.mouse.up();
  await expect(page.getByLabel("Anchor x 1")).not.toHaveValue("24");

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
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Needs review")).toBeVisible();

  await expectAlignedCoordinateStage(page);
  const registryMarkerBox = await expectEighteenPixelMarker(
    page,
    '[data-terminal-hotspot="1"]'
  );
  await page.mouse.move(
    registryMarkerBox.x + registryMarkerBox.width / 2,
    registryMarkerBox.y + registryMarkerBox.height / 2
  );
  await expect(page.locator('[data-terminal-tooltip="1"]')).toContainText(
    "Terminal 1"
  );
  await expect(page.locator('[data-terminal-tooltip="1"]')).toContainText(
    "Signal positive"
  );

  await page.locator('[data-terminal-hotspot="1"]').focus();
  await page.keyboard.press("Enter");
  await page.mouse.move(registryMarkerBox.x - 30, registryMarkerBox.y - 30);
  await expect(page.locator('[data-terminal-tooltip="1"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-terminal-tooltip="1"]')).toHaveCount(0);

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

test("keeps a portrait import aligned and selects the intended dense terminal", async ({
  page
}) => {
  await page.goto("/symbols/new");
  await page.setInputFiles("#svg-file", {
    name: "portrait-device.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(portraitSvg)
  });

  await expect(page.getByText("SVG imported.")).toBeVisible();
  await expectAlignedCoordinateStage(page);
  const markerBox = await expectEighteenPixelMarker(
    page,
    '[data-import-anchor-marker="3.2"]'
  );
  await expect(page.getByLabel("Anchor x 3.2")).toHaveValue("19.5");

  await page.mouse.move(
    markerBox.x + markerBox.width / 2,
    markerBox.y + markerBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    markerBox.x + markerBox.width / 2 + 10,
    markerBox.y + markerBox.height / 2 + 12
  );
  await page.mouse.up();

  await expect(page.getByLabel("Anchor x 3.2")).not.toHaveValue("19.5");
  await expect(page.getByLabel("Anchor x 3.1")).toHaveValue("19.5");
});

test("imports a Figma component position as read-only registry geometry", async ({
  page
}) => {
  const runId = Date.now().toString();
  const symbolName = `Component Position Device ${runId}`;

  await page.goto("/symbols/new");
  await page.setInputFiles("#svg-file", {
    name: "component-position-device.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(componentPositionSvg)
  });

  await expect(page.getByText("SVG imported.")).toBeVisible();
  await expect(page.getByText(/1 component position detected/)).toBeVisible();
  await expect(
    page.locator('[data-import-component-position="1:relay"]')
  ).toBeVisible();

  await page.getByLabel("Display name").fill(symbolName);
  await page
    .getByLabel("Symbol key")
    .fill(`component_position_device_${runId}`);
  await page.getByLabel("Terminal function A1").fill("Relay coil A1");
  await page.getByRole("button", { name: "Save imported symbol" }).click();

  await expect(
    page.getByRole("heading", { name: symbolName, exact: true })
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Assignment required for approval")).toBeVisible();

  const hotspot = page.locator(
    '[data-component-position-hotspot="1:relay"]'
  );
  const hotspotBox = await hotspot.boundingBox();
  expect(hotspotBox).not.toBeNull();
  await page.mouse.move(
    hotspotBox!.x + hotspotBox!.width / 2,
    hotspotBox!.y + hotspotBox!.height / 2
  );
  await expect(
    page.locator('[data-component-position-tooltip="1:relay"]')
  ).toContainText("Relay");
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
