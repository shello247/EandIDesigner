import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { parseMetadataJson } from "../../src/features/symbol_registry/data/schema";
import { updateSymbolNetworkProfile } from "../../src/features/symbol_registry/data/mutations";

const managedSwitchSvg = `
<svg viewBox="0 0 180 110" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="160" height="75" rx="3" fill="white" stroke="black"/>
  <text x="90" y="45" text-anchor="middle">Managed Switch</text>
  <circle id="network_port:ETH1" cx="35" cy="92" r="3"/>
  <circle id="network_port:ETH2" cx="70" cy="92" r="3"/>
  <circle id="port:eth3" cx="105" cy="92" r="3"/>
  <g id="network_port:ETH4" transform="translate(140 92)">
    <rect x="-3" y="-3" width="6" height="6"/>
  </g>
</svg>`;

test("imports a managed four-port network switch", async ({ page }) => {
  const runId = Date.now().toString();
  const symbolName = `Managed Network Switch ${runId}`;
  const symbolKey = `managed_network_switch_${runId}`;

  await page.goto("/symbols/new");
  await page.setInputFiles("#svg-file", {
    name: "managed-network-switch.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(managedSwitchSvg)
  });

  await expect(page.getByText("SVG imported.")).toBeVisible();
  await expect(page.getByText("Detected anchors")).toBeVisible();

  await page.getByLabel("Display name").fill(symbolName);
  await page.getByLabel("Symbol key").fill(symbolKey);
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("network_device");
  await expect(
    page.getByRole("button", { name: "Save imported symbol" })
  ).toBeDisabled();

  await page.getByLabel("Device type").selectOption("switch");
  await page.getByLabel("Managed status").selectOption("managed");

  for (const portKey of ["ETH1", "ETH2", "ETH3", "ETH4"]) {
    await page
      .getByLabel(`Network port media ${portKey}`)
      .selectOption("copper");
    await page.getByLabel(`Network port speed ${portKey}`).fill("1000");
    await page
      .getByLabel(`Network port protocols ${portKey}`)
      .fill("Ethernet, PROFINET, ethernet");
  }

  await expect(
    page.getByRole("button", { name: "Save imported symbol" })
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save imported symbol" }).click();

  await expect(
    page.getByRole("heading", { name: symbolName, exact: true })
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Needs review")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Network Profile", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Panel Layout Metadata")).toHaveCount(0);
  await expect(page.getByText("Terminal Map", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "AI verify" })).toHaveCount(0);

  const artworkBounds = await page
    .locator('[data-testid="svg-coordinate-artwork"]')
    .boundingBox();
  const overlayBounds = await page
    .locator('[data-testid="svg-coordinate-overlay"]')
    .boundingBox();
  expect(artworkBounds).not.toBeNull();
  expect(overlayBounds).not.toBeNull();
  expect(Math.abs(artworkBounds!.x - overlayBounds!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(artworkBounds!.y - overlayBounds!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(artworkBounds!.width - overlayBounds!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(artworkBounds!.height - overlayBounds!.height)).toBeLessThanOrEqual(1);
  expect(overlayBounds!.width).toBeLessThanOrEqual(620.5);
  expect(overlayBounds!.height).toBeLessThanOrEqual(620.5);

  const portMarkerBounds = await page
    .locator('[data-network-port-hotspot="ETH1"]')
    .boundingBox();
  expect(portMarkerBounds).not.toBeNull();
  expect(portMarkerBounds!.width).toBeGreaterThanOrEqual(17);
  expect(portMarkerBounds!.width).toBeLessThanOrEqual(20);
  await page.mouse.move(
    portMarkerBounds!.x + portMarkerBounds!.width / 2,
    portMarkerBounds!.y + portMarkerBounds!.height / 2
  );
  await expect(page.locator('[data-network-port-tooltip="ETH1"]')).toContainText(
    "Network port ETH1"
  );
  await expect(page.locator('[data-network-port-tooltip="ETH1"]')).toContainText(
    "1000 Mbps"
  );
  await expect(page.locator('[data-network-port-tooltip="ETH1"]')).toContainText(
    "PROFINET"
  );

  await page.getByLabel("Manufacturer", { exact: true }).fill("Network Works");
  await page.getByLabel("Model", { exact: true }).fill("NWS-4F");
  await page.getByLabel("Network port label ETH1").fill("Primary uplink");
  await page.getByLabel("Network port media ETH1").selectOption("fiber");
  await page.getByRole("button", { name: "Save network profile" }).click();
  await expect(
    page.getByText("Network profile updated. Validation was refreshed.")
  ).toBeVisible();
  await expect(page.getByText("No validation issues found.")).toBeVisible();

  const symbol = await prisma.symbol.findUnique({
    where: { symbolKey },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1
      },
      sourceAssets: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  expect(symbol?.category).toBe("network_device");
  expect(symbol?.status).toBe("needs_review");
  expect(symbol?.manufacturer).toBe("Network Works");
  expect(symbol?.model).toBe("NWS-4F");

  const version = symbol?.versions[0];
  expect(version).toBeDefined();
  expect(version?.svg).not.toContain("network_port:");
  expect(version?.svg).not.toContain("port:eth3");

  const metadata = parseMetadataJson(version?.metadataJson ?? "");
  expect(metadata.terminals).toEqual([]);
  expect(metadata.networkProfile?.deviceType).toBe("switch");
  expect(metadata.networkProfile?.managed).toBe(true);
  expect(metadata.networkProfile?.ports).toHaveLength(4);
  expect(metadata.networkProfile?.ports.map((port) => port.key)).toEqual([
    "ETH1",
    "ETH2",
    "ETH3",
    "ETH4"
  ]);
  expect(metadata.networkProfile?.ports[0]).toMatchObject({
    label: "Primary uplink",
    anchorKey: "ETH1",
    media: "fiber",
    speedMbps: 1000,
    protocolHints: ["Ethernet", "PROFINET"]
  });

  const approvedVersionId = version?.id;
  const approvedMetadataJson = version?.metadataJson;

  await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await expect(
    page.getByText("This version is approved and its content is read-only.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save network profile" })
  ).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await expect(page.getByText("Primary uplink", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save network profile" })
  ).toHaveCount(0);

  const approvedSymbol = await prisma.symbol.findUnique({
    where: { symbolKey },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    }
  });
  const approvedVersion = approvedSymbol?.versions[0];

  expect(approvedSymbol?.status).toBe("approved");
  expect(approvedVersion?.status).toBe("approved");
  expect(approvedVersion?.id).toBe(approvedVersionId);
  expect(approvedVersion?.metadataJson).toBe(approvedMetadataJson);

  await expect(
    updateSymbolNetworkProfile({
      versionId: approvedVersionId ?? "",
      manufacturer: "Changed after approval",
      model: "NWS-4F",
      networkProfile: metadata.networkProfile!
    })
  ).rejects.toThrow(/immutable/i);

  const sourceDataUrl = symbol?.sourceAssets[0]?.dataUrl ?? "";
  const encodedSource = sourceDataUrl.split(",", 2)[1] ?? "";
  expect(Buffer.from(encodedSource, "base64").toString("utf8")).toContain(
    "network_port:ETH1"
  );
});
