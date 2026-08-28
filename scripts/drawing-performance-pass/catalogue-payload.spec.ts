import { expect, test } from "@playwright/test";
import { guard, output, write } from "../drawing-performance-audit/common";
import {
  auditSymbol,
  seed,
  setCatalogueCount
} from "../drawing-performance-audit/fixtures";

guard();

test("initial drawing response excludes unused full symbol records", async ({
  browser
}) => {
  await seed();
  const samples: Array<{
    catalogueSize: number;
    responseBytes: number;
    unusedSvgMarkerPresent: boolean;
    unusedSummaryPresent: boolean;
  }> = [];

  for (const catalogueSize of [25, 250, 1000]) {
    await setCatalogueCount(catalogueSize);
    const unused = auditSymbol(catalogueSize - 1);
    const marker = `UNUSED_FULL_SVG_MARKER_${catalogueSize}`;
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.symbolVersion.update({
      where: { id: unused.versionId },
      data: {
        svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${marker}</text></svg>`
      }
    });
    await prisma.$disconnect();

    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    const response = await page.goto("/drawings/audit_mixed_10", {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 60000
    });
    const body = await response!.text();
    const sample = {
      catalogueSize,
      responseBytes: Buffer.byteLength(body),
      unusedSvgMarkerPresent: body.includes(marker),
      unusedSummaryPresent: body.includes(unused.displayName)
    };
    samples.push(sample);
    expect(sample.unusedSvgMarkerPresent).toBe(false);
    expect(sample.unusedSummaryPresent).toBe(true);
    await context.close();
  }

  write("catalogue-payload-task017.json", {
    output,
    samples
  });
});
