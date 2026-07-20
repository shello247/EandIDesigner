import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import {
  approveSymbolVersion,
  saveSymbolDraft
} from "../../src/features/symbol_registry/data/mutations";
import type { SymbolMetadata } from "../../src/features/symbol_registry/data/schema";
import { parseNetworkMapModelJson } from "../../src/features/network_maps/data/schema";
import {
  listApprovedNetworkSymbolVersionsByIds,
  listNetworkSymbolCatalogForMapping
} from "../../src/features/symbol_registry/api/public";

const networkDeviceSvg = `
<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="5" width="90" height="60" fill="white" stroke="black"/>
  <path d="M 10 25 H 90 M 10 45 H 90" stroke="black" fill="none"/>
</svg>`;

function networkMetadata(params: {
  symbolKey: string;
  displayName: string;
  manufacturer?: string;
  model?: string;
  managed?: boolean;
  protocol: string;
}): SymbolMetadata {
  return {
    symbolKey: params.symbolKey,
    displayName: params.displayName,
    manufacturer: params.manufacturer,
    model: params.model,
    category: "network_device",
    viewBox: { x: 0, y: 0, width: 100, height: 80 },
    terminals: [],
    anchors: [{ key: "ETH1", x: 18, y: 70, kind: "network_port" }],
    networkProfile: {
      deviceType: "switch",
      managed: params.managed,
      ports: [
        {
          key: "ETH1",
          label: "Primary uplink",
          anchorKey: "ETH1",
          media: "fiber",
          speedMbps: 1000,
          protocolHints: [params.protocol]
        }
      ]
    }
  };
}

test("creates and exports an industrial network map package", async ({ page }) => {
  test.setTimeout(90000);

  const runId = Date.now().toString();
  const title = `E2E Network Map ${runId}`;
  const mapKey = `e2e_network_map_${runId}`;
  const approvedName = `Phase 3 Managed Switch ${runId}`;
  const approvedKey = `phase_3_managed_switch_${runId}`;
  const draftName = `Phase 3 Draft Switch ${runId}`;
  const draftKey = `phase_3_draft_switch_${runId}`;
  const archivedKey = `phase_3_archived_switch_${runId}`;
  const malformedKey = `phase_3_malformed_switch_${runId}`;
  const nonNetworkKey = `phase_3_non_network_${runId}`;
  const protocol = `Phase3Protocol${runId}`;
  const fixtureKeys = [
    approvedKey,
    draftKey,
    archivedKey,
    malformedKey,
    nonNetworkKey
  ];
  let networkMapId: string | undefined;
  let placedNodeId: string | undefined;

  try {
    const approvedDetail = await saveSymbolDraft({
      svg: networkDeviceSvg,
      metadata: networkMetadata({
        symbolKey: approvedKey,
        displayName: approvedName,
        manufacturer: "Phase 3 Networks",
        model: "P3-SW-1",
        managed: true,
        protocol
      })
    });
    const approvedVersionId = approvedDetail?.latestVersion?.id;

    if (!approvedVersionId) {
      throw new Error("Expected an approved fixture version id.");
    }

    await approveSymbolVersion(approvedVersionId);

    const draftDetail = await saveSymbolDraft({
      svg: networkDeviceSvg,
      metadata: networkMetadata({
        symbolKey: draftKey,
        displayName: draftName,
        protocol: `${protocol}Draft`
      })
    });
    const draftVersionId = draftDetail?.latestVersion?.id;

    const archivedDetail = await saveSymbolDraft({
      svg: networkDeviceSvg,
      metadata: networkMetadata({
        symbolKey: archivedKey,
        displayName: `Phase 3 Archived Switch ${runId}`,
        protocol: `${protocol}Archived`
      })
    });
    const archivedVersionId = archivedDetail?.latestVersion?.id;

    if (!draftVersionId || !archivedVersionId) {
      throw new Error("Expected draft and archived fixture version ids.");
    }

    await prisma.$transaction([
      prisma.symbol.update({
        where: { symbolKey: archivedKey },
        data: { status: "archived" }
      }),
      prisma.symbolVersion.update({
        where: { id: archivedVersionId },
        data: { status: "archived" }
      })
    ]);

    const malformedSymbol = await prisma.symbol.create({
      data: {
        symbolKey: malformedKey,
        displayName: `Phase 3 Malformed Switch ${runId}`,
        category: "network_device",
        status: "approved",
        versions: {
          create: {
            versionNumber: 1,
            status: "approved",
            svg: networkDeviceSvg,
            metadataJson: "{malformed-json"
          }
        }
      },
      include: { versions: true }
    });
    const malformedVersionId = malformedSymbol.versions[0].id;

    const nonNetworkMetadata: SymbolMetadata = {
      symbolKey: nonNetworkKey,
      displayName: `Phase 3 Electrical Symbol ${runId}`,
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 100, height: 80 },
      terminals: [],
      anchors: []
    };
    const nonNetworkSymbol = await prisma.symbol.create({
      data: {
        symbolKey: nonNetworkKey,
        displayName: nonNetworkMetadata.displayName,
        category: nonNetworkMetadata.category,
        status: "approved",
        versions: {
          create: {
            versionNumber: 1,
            status: "approved",
            svg: networkDeviceSvg,
            metadataJson: JSON.stringify(nonNetworkMetadata)
          }
        }
      },
      include: { versions: true }
    });
    const nonNetworkVersionId = nonNetworkSymbol.versions[0].id;

    const catalog = await listNetworkSymbolCatalogForMapping();
    const fixtureCatalogKeys = catalog
      .filter((item) => fixtureKeys.includes(item.symbolKey))
      .map((item) => item.symbolKey);
    expect(fixtureCatalogKeys).toEqual([approvedKey]);
    expect(catalog.find((item) => item.symbolKey === approvedKey)).not.toHaveProperty(
      "svg"
    );

    const referencedSymbols = await listApprovedNetworkSymbolVersionsByIds([
      approvedVersionId,
      draftVersionId,
      archivedVersionId,
      malformedVersionId,
      nonNetworkVersionId,
      approvedVersionId
    ]);
    expect(referencedSymbols.map((symbol) => symbol.versionId)).toEqual([
      approvedVersionId
    ]);

    await page.route(
      `**/symbols/network-assets/${approvedVersionId}`,
      async (route) => route.abort()
    );
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
    await expect(
      page.getByTestId("network-map-paper").locator("[data-network-node-id]")
    ).toHaveCount(0);

    const approvedCatalogItem = page.locator(
      `[data-network-catalog-version="${approvedVersionId}"]`
    );
    await expect(approvedCatalogItem).toContainText(approvedName);
    await expect(approvedCatalogItem.getByTestId("network-preview-error")).toBeVisible();
    await expect(page.getByText(draftName, { exact: true })).toHaveCount(0);

    await page.unroute(`**/symbols/network-assets/${approvedVersionId}`);
    await page.reload();
    await page.getByLabel("Search network devices").fill(`${protocol} ETH1`);
    await expect(approvedCatalogItem).toBeVisible();
    await page.getByLabel("Device type").selectOption("switch");
    await page.getByLabel("Managed").selectOption("managed");
    await expect(approvedCatalogItem).toContainText("Phase 3 Networks / P3-SW-1");
    await expect(approvedCatalogItem).toContainText("Fiber");

    const approvedPreview = approvedCatalogItem.getByRole("img", {
      name: `Preview of ${approvedName}`
    });
    await expect(approvedPreview).toBeVisible();
    await expect
      .poll(() =>
        approvedPreview.evaluate(
          (image) => image instanceof HTMLImageElement && image.naturalWidth > 0
        )
      )
      .toBe(true);

    await page.getByLabel("Search network devices").fill(`no-result-${runId}`);
    await expect(
      page.getByText("No network devices match the current filters.")
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(approvedCatalogItem).toBeVisible();

    const assetResponse = await page.request.get(
      `/symbols/network-assets/${approvedVersionId}`
    );
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()["content-type"]).toContain("image/svg+xml");
    expect(assetResponse.headers()["cache-control"]).toBe(
      "public, max-age=0, must-revalidate"
    );
    expect(assetResponse.headers()["x-content-type-options"]).toBe("nosniff");
    const etag = assetResponse.headers().etag;
    expect(etag).toBeTruthy();

    const conditionalResponse = await page.request.get(
      `/symbols/network-assets/${approvedVersionId}`,
      { headers: { "If-None-Match": etag } }
    );
    expect(conditionalResponse.status()).toBe(304);
    expect(
      (await page.request.get(`/symbols/network-assets/${draftVersionId}`)).status()
    ).toBe(404);
    await page
      .getByRole("button", { name: "Set network map zoom to 100 percent" })
      .click();
    await expect(page.getByTestId("network-zoom-display")).toHaveText("100%");
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByTestId("network-zoom-display")).not.toHaveText("100%");

    await approvedCatalogItem.click();
    await expect(page.getByTestId("network-placement-status")).toContainText(
      `Placing: ${approvedName}`
    );
    await expect(approvedCatalogItem).toHaveAttribute("aria-pressed", "true");

    const interactionOverlay = page.getByTestId(
      "network-map-interaction-overlay"
    );
    const overlayBounds = await interactionOverlay.boundingBox();

    if (!overlayBounds) {
      throw new Error("Expected the active network sheet overlay bounds.");
    }

    await interactionOverlay.click({
      position: {
        x: overlayBounds.width * 0.52,
        y: overlayBounds.height * 0.42
      }
    });
    await expect(page.getByTestId("network-placement-status")).toHaveCount(0);
    await expect(
      page.getByTestId("network-map-paper").locator("[data-network-node-id]")
    ).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Selected Device" })
    ).toBeVisible();

    const renderedNode = page
      .getByTestId("network-map-paper")
      .locator("[data-network-node-id]")
      .first();
    placedNodeId = (await renderedNode.getAttribute("data-network-node-id")) ??
      undefined;

    if (!placedNodeId) {
      throw new Error("Expected a stable placed network node id.");
    }

    await page.getByLabel("Tag", { exact: true }).fill("SW-E2E-001");
    await page.getByLabel("Tag", { exact: true }).press("Enter");
    await page.getByLabel("Label", { exact: true }).fill("Main process switch");
    await page.getByLabel("Label", { exact: true }).press("Enter");
    await page.getByLabel("IP address", { exact: true }).fill("10.42.0.10");
    await page.getByLabel("IP address", { exact: true }).press("Enter");
    await page.getByLabel("VLAN", { exact: true }).fill("42");
    await page.getByLabel("VLAN", { exact: true }).press("Enter");
    await page.getByLabel("Rotation", { exact: true }).fill("90");
    await page.getByLabel("Rotation", { exact: true }).press("Enter");
    await page.getByLabel("Scale", { exact: true }).fill("0.5");
    await page.getByLabel("Scale", { exact: true }).press("Enter");

    const nodeHit = page.locator(
      `[data-network-node-hit="${placedNodeId}"]`
    );
    const nodeHitBounds = await nodeHit.boundingBox();

    if (!nodeHitBounds) {
      throw new Error("Expected the placed network node hit geometry.");
    }

    await page.mouse.move(
      nodeHitBounds.x + nodeHitBounds.width / 2,
      nodeHitBounds.y + nodeHitBounds.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      nodeHitBounds.x + nodeHitBounds.width / 2 + 72,
      nodeHitBounds.y + nodeHitBounds.height / 2 + 36,
      { steps: 4 }
    );
    await page.mouse.up();

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

    await page.reload();
    await expect(
      page.locator(`[data-network-node-id="${placedNodeId}"]`)
    ).toBeVisible();
    await expect(page.getByText("Network note from e2e")).toBeVisible();

    const storedMap = await prisma.networkMap.findUnique({
      where: { id: networkMapId }
    });
    const storedModel = parseNetworkMapModelJson(storedMap?.modelJson ?? "");
    const storedNode = storedModel.sheets
      .flatMap((sheet) => sheet.nodes)
      .find((node) => node.id === placedNodeId);

    expect(storedNode).toMatchObject({
      symbolId: approvedDetail?.id,
      versionId: approvedVersionId,
      tag: "SW-E2E-001",
      label: "Main process switch",
      ipAddress: "10.42.0.10",
      vlanId: 42,
      rotation: 90,
      scale: 0.5
    });

    const printResponse = await page.request.get(
      `/networking/${networkMapId}/print`
    );
    expect(printResponse.ok()).toBeTruthy();
    const printHtml = await printResponse.text();
    expect(printHtml).toContain("window.print()");
    expect(printHtml).toContain("Back to network map");
    expect(printHtml).toContain('data-network-title-block="true"');
    expect(printHtml).toContain(`data-network-node-id="${placedNodeId}"`);
    expect(printHtml).toContain(`data-network-version-id="${approvedVersionId}"`);
    expect(printHtml).toContain(
      `translate(${storedNode?.x} ${storedNode?.y}) scale(0.5)`
    );

    const pdfResponse = await page.request.get(`/networking/${networkMapId}/pdf`);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe("%PDF");

    const reloadedNodeHit = page.locator(
      `[data-network-node-hit="${placedNodeId}"]`
    );
    await reloadedNodeHit.click();
    await page.keyboard.press("Delete");
    await expect(
      page.locator(`[data-network-node-id="${placedNodeId}"]`)
    ).toHaveCount(0);
    await expect(page.getByTestId("network-map-toast")).toContainText(
      "Device deleted."
    );

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
    await prisma.symbol.deleteMany({
      where: { symbolKey: { in: fixtureKeys } }
    });
  }
});
