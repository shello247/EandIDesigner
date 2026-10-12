import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";

const validPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

test.describe.serial("BOM item AI enrichment and documents", () => {
  const createdItemIds: string[] = [];

  test.afterAll(async () => {
    if (createdItemIds.length > 0) {
      await prisma.bomItem.updateMany({ where: { id: { in: createdItemIds } }, data: { status: "archived" } });
    }
  });

  test("extracts blank fields, preserves user data, and manages PDF documents", async ({
    page
  }) => {
    const runId = Date.now().toString();
    const displayName = `AI Enriched Item ${runId}`;
    const documentName = `datasheet-${runId}.pdf`;

    await page.goto("/bom/items");
    await page.getByRole("button", { name: "New item" }).click();
    await page.locator("#bom-display-name").fill(displayName);
    await page.locator("#bom-product-url").fill("https://example.com/product");
    await page.getByTestId("bom-item-extract-button").click();

    await expect(page.getByText("medium confidence")).toBeVisible();
    await expect(page.locator("#bom-display-name")).toHaveValue(displayName);
    await expect(page.locator("#bom-manufacturer")).toHaveValue(
      "Mock Manufacturer"
    );
    await expect(page.locator("#bom-part-number")).toHaveValue("AI-100");
    await page.getByRole("dialog", { name: "New item" }).getByLabel("Device Type", { exact: true }).selectOption("other");

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByTestId("bom-item-document-input").setInputFiles({
      name: documentName,
      mimeType: "application/pdf",
      buffer: validPdf
    });
    await expect(page.getByText(documentName)).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save item" }).click();
    await expect(page.getByText("BOM item saved.")).toBeVisible();

    const item = await prisma.bomItem.findFirst({
      where: { displayName },
      include: { documents: true }
    });
    expect(item).not.toBeNull();
    createdItemIds.push(item!.id);
    expect(item!.productUrl).toBe("https://example.com/product");
    expect(item!.productUrlExtractedAt).not.toBeNull();
    expect(item!.documents).toHaveLength(1);
    expect((await (await page.request.get("/bom/items")).text())).not.toContain(
      "data:application/pdf"
    );
    expect(
      (await (await page.request.get(`/bom/items/${item!.id}`)).text())
    ).not.toContain("data:application/pdf");

    await page.getByRole("link", { name: displayName }).click();
    await expect(page.getByRole("heading", { name: displayName })).toBeVisible();
    await expect(
      page.locator('a[href="https://example.com/product"]').first()
    ).toBeVisible();
    await page.getByRole("tab", { name: "Documents", exact: true }).click();
    await expect(page.getByText(documentName, { exact: false })).toBeVisible();

    const documentLink = page.locator(
      `a[href="/api/bom/items/documents/${item!.documents[0]!.id}"]`
    );
    const documentUrl = await documentLink.getAttribute("href") as string;
    const response = await page.request.get(documentUrl);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect(response.headers()["content-length"]).toBe(String(validPdf.byteLength));
    expect(response.headers()["content-disposition"]).toContain("attachment;");
    expect(response.headers()["cache-control"]).toBe(
      "private, max-age=31536000, immutable"
    );
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["etag"]).toMatch(/^"sha256-/);
    expect(await response.body()).toEqual(validPdf);
    const notModified = await page.request.get(
      documentUrl,
      { headers: { "If-None-Match": response.headers()["etag"]! } }
    );
    expect(notModified.status()).toBe(304);
    expect((await notModified.body()).byteLength).toBe(0);
    const missing = await page.request.get(
      "/api/bom/items/documents/missing-document-id"
    );
    expect(missing.status()).toBe(404);
    expect(missing.headers()["cache-control"]).toBe("private, no-store");

    page.once("dialog", request => request.accept());
    await page.getByRole("button", { name: "Remove document", exact: true }).click();
    await expect(page.getByText(documentName, { exact: false })).toHaveCount(0);
    const retiredDocument = await prisma.bomItemDocument.findUniqueOrThrow({ where: { id: item!.documents[0]!.id } });
    expect(retiredDocument.archivedAt).not.toBeNull();
    expect(await prisma.bomItemDocument.count({ where: { itemId: item!.id, archivedAt: null } })).toBe(0);
    const history = await prisma.bomItemEngineeringRevision.findMany({ where: { itemId: item!.id }, orderBy: { revisionNumber: "asc" }, include: { documents: true } });
    expect(history.map(revision => revision.documents.length)).toEqual([0, 1, 0]);
    const historicalDownload = await page.request.get(documentUrl);
    expect(historicalDownload.status()).toBe(200);
    expect(await historicalDownload.body()).toEqual(validPdf);
    await page.reload();
    await page.getByRole("tab", { name: "Documents", exact: true }).click();
    await expect(page.getByText(documentName, { exact: false })).toHaveCount(0);
  });

  test("retains the created item and retries after a document upload failure", async ({
    page
  }) => {
    const runId = `${Date.now()}-retry`;
    const displayName = `AI Document Retry ${runId}`;
    const invalidName = `invalid-${runId}.pdf`;
    const validName = `valid-${runId}.pdf`;

    await page.goto("/bom/items");
    await page.getByRole("button", { name: "New item" }).click();
    await page.locator("#bom-display-name").fill(displayName);
    await page.getByRole("dialog", { name: "New item" }).getByLabel("Device Type", { exact: true }).selectOption("other");
    await page.locator("#bom-unit").selectOption("each");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByTestId("bom-item-document-input").setInputFiles({
      name: invalidName,
      mimeType: "application/pdf",
      buffer: Buffer.from("not a pdf")
    });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save item" }).click();

    await expect(page.getByText(/Item saved, but .* could not be uploaded/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry uploads" })).toBeVisible();
    const firstSave = await prisma.bomItem.findMany({
      where: { displayName },
      select: { id: true }
    });
    expect(firstSave).toHaveLength(1);
    createdItemIds.push(firstSave[0]!.id);

    await page.getByRole("button", { name: `Remove ${invalidName}` }).click();
    await page.getByTestId("bom-item-document-input").setInputFiles({
      name: validName,
      mimeType: "application/pdf",
      buffer: validPdf
    });
    await page.getByRole("button", { name: "Upload documents" }).click();
    await expect(page.getByText("BOM item saved.")).toBeVisible();

    expect(
      await prisma.bomItem.count({ where: { displayName } })
    ).toBe(1);
    expect(
      await prisma.bomItemDocument.count({
        where: { itemId: firstSave[0]!.id, fileName: validName }
      })
    ).toBe(1);
  });
});
