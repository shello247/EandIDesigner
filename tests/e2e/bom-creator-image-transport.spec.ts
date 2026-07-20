import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import {
  createBomItem,
  updateBomItem
} from "../../src/features/bom_creator/data/mutations";
import {
  getBomItemDetail,
  listBomItems
} from "../../src/features/bom_creator/data/queries";

test.describe.configure({ mode: "serial" });

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const displayName = `BOM image transport ${runId}`;
const foreignDisplayName = `BOM image transport foreign ${runId}`;
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const pngBytes = Buffer.from(pngBase64, "base64");
const pngDataUrl = `data:image/png;base64,${pngBase64}`;

let itemId = "";
let firstImageId = "";
let secondImageId = "";
let retainedImageId = "";

function newImage(fileName: string, isPrimary: boolean, sortOrder: number) {
  return {
    kind: "new" as const,
    fileName,
    mimeType: "image/png",
    sizeBytes: pngBytes.byteLength,
    dataUrl: pngDataUrl,
    isPrimary,
    sortOrder
  };
}

test.beforeAll(async () => {
  const item = await createBomItem({
    displayName,
    category: "accessory",
    unit: "each",
    images: [
      newImage(`first-${runId}.png`, true, 0),
      newImage(`second-${runId}.png`, false, 1)
    ]
  });

  if (!item) {
    throw new Error("Image transport fixture could not be created.");
  }

  itemId = item.id;
  const images = await prisma.bomItemImage.findMany({
    where: { itemId },
    orderBy: { sortOrder: "asc" }
  });
  firstImageId = images[0]?.id ?? "";
  secondImageId = images[1]?.id ?? "";
});

test.afterAll(async () => {
  await prisma.bomItem.deleteMany({
    where: { displayName: { in: [displayName, foreignDisplayName] } }
  });
});

test("serves binary images with cache headers and metadata-only DTOs", async ({
  page
}) => {
  const [detail, list] = await Promise.all([
    getBomItemDetail(itemId),
    listBomItems({ includeArchived: true })
  ]);
  const itemSummary = list.find((item) => item.id === itemId);

  expect(detail).not.toBeNull();
  expect(itemSummary).toBeDefined();
  expect(JSON.stringify(detail)).not.toContain("data:image/");
  expect(JSON.stringify(itemSummary)).not.toContain("data:image/");
  expect(detail?.images[0]?.imageUrl).toBe(
    `/api/bom/items/images/${firstImageId}`
  );

  const imageResponse = await page.request.get(detail!.images[0].imageUrl);
  const etag = imageResponse.headers().etag;

  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toBe("image/png");
  expect(imageResponse.headers()["content-length"]).toBe(
    String(pngBytes.byteLength)
  );
  expect(imageResponse.headers()["cache-control"]).toBe(
    "private, max-age=31536000, immutable"
  );
  expect(imageResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(etag).toMatch(/^"sha256-/);
  expect(Buffer.from(await imageResponse.body())).toEqual(pngBytes);

  const cachedResponse = await page.request.get(detail!.images[0].imageUrl, {
    headers: { "If-None-Match": etag }
  });
  expect(cachedResponse.status()).toBe(304);
  expect((await cachedResponse.body()).byteLength).toBe(0);

  const missingResponse = await page.request.get(
    "/api/bom/items/images/missing-image-id"
  );
  expect(missingResponse.status()).toBe(404);
  expect(missingResponse.headers()["cache-control"]).toBe("private, no-store");

  const pageResponse = await page.request.get("/bom/items");
  expect(await pageResponse.text()).not.toContain("data:image/");
});

test("reconciles metadata, ordering, additions, and removals without replacing IDs", async () => {
  await updateBomItem({
    id: itemId,
    images: [
      {
        kind: "existing",
        id: secondImageId,
        caption: "Second is first",
        isPrimary: true,
        sortOrder: 50
      },
      {
        kind: "existing",
        id: firstImageId,
        isPrimary: false,
        sortOrder: 10
      },
      newImage(`third-${runId}.png`, false, 99)
    ]
  });

  const afterAdd = await prisma.bomItemImage.findMany({
    where: { itemId },
    orderBy: { sortOrder: "asc" }
  });

  expect(afterAdd.map((image) => image.id).slice(0, 2)).toEqual([
    secondImageId,
    firstImageId
  ]);
  expect(afterAdd.map((image) => image.sortOrder)).toEqual([0, 1, 2]);
  expect(afterAdd[0]).toMatchObject({
    caption: "Second is first",
    isPrimary: true
  });
  retainedImageId = afterAdd[2].id;

  await updateBomItem({
    id: itemId,
    images: [
      {
        kind: "existing",
        id: secondImageId,
        caption: "Second is first",
        isPrimary: false,
        sortOrder: 0
      },
      {
        kind: "existing",
        id: retainedImageId,
        isPrimary: false,
        sortOrder: 1
      }
    ]
  });

  const afterRemove = await prisma.bomItemImage.findMany({
    where: { itemId },
    orderBy: { sortOrder: "asc" }
  });
  expect(afterRemove.map((image) => image.id)).toEqual([
    secondImageId,
    retainedImageId
  ]);
  expect(afterRemove[0].isPrimary).toBe(true);
  await expect(
    prisma.bomItemImage.findUnique({ where: { id: firstImageId } })
  ).resolves.toBeNull();

  const foreignItem = await createBomItem({
    displayName: foreignDisplayName,
    category: "accessory",
    unit: "each",
    images: [newImage(`foreign-${runId}.png`, true, 0)]
  });
  const foreignImage = await prisma.bomItemImage.findFirst({
    where: { itemId: foreignItem!.id }
  });

  await expect(
    updateBomItem({
      id: itemId,
      images: [
        {
          kind: "existing",
          id: foreignImage!.id,
          isPrimary: true,
          sortOrder: 0
        }
      ]
    })
  ).rejects.toThrow(/does not belong/);
  await expect(
    prisma.bomItemImage.count({ where: { itemId } })
  ).resolves.toBe(2);
});

test("renders persisted images and saves pasted images without retransmitting existing data", async ({
  page
}) => {
  await page.goto("/bom/items");
  const row = page.getByRole("row").filter({ hasText: displayName });
  await expect(row.locator("img")).toBeVisible();
  await row.getByRole("button", { name: `Edit ${displayName}` }).click();
  await expect(page.getByRole("dialog", { name: `Edit ${displayName}` })).toBeVisible();
  await page.getByRole("button", { name: "2 Images", exact: true }).click();
  await expect(page.getByText(`second-${runId}.png`)).toBeVisible();
  await expect(page.getByText(`third-${runId}.png`)).toBeVisible();

  await page.getByTestId("bom-item-image-dropzone").evaluate(
    (dropZone, input) => {
      const bytes = Uint8Array.from(atob(input.base64), (character) =>
        character.charCodeAt(0)
      );
      const file = new File([bytes], input.fileName, { type: "image/png" });
      const clipboardData = new DataTransfer();
      clipboardData.items.add(file);
      dropZone.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData
        })
      );
    },
    {
      base64: pngBase64,
      fileName: `pasted-phase2-${runId}.png`
    }
  );
  await expect(page.getByText(`pasted-phase2-${runId}.png`)).toBeVisible();
  await page.locator("#bom-image-caption-1").fill("Retained caption");
  await page
    .getByRole("button", { name: `Remove second-${runId}.png` })
    .click();
  await page
    .getByRole("button", { name: `Make pasted-phase2-${runId}.png primary` })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("BOM item saved.")).toBeVisible();

  const finalImages = await prisma.bomItemImage.findMany({
    where: { itemId },
    orderBy: { sortOrder: "asc" }
  });
  expect(finalImages).toHaveLength(2);
  expect(finalImages.some((image) => image.id === retainedImageId)).toBe(true);
  expect(finalImages.some((image) => image.id === secondImageId)).toBe(false);
  expect(finalImages.find((image) => image.id === retainedImageId)?.caption).toBe(
    "Retained caption"
  );
  expect(finalImages.find((image) => image.isPrimary)?.fileName).toBe(
    `pasted-phase2-${runId}.png`
  );

  await page.getByRole("link", { name: displayName }).click();
  await expect(page.getByRole("heading", { name: displayName })).toBeVisible();
  await expect(page.locator("img")).toHaveCount(3);
});
