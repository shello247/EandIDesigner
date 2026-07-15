import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import {
  createDefaultDrawingModel,
  type DrawingModel
} from "../../src/features/drawing_canvas/data/schema";
import type { BomItemDetail } from "../../src/features/bom_creator/data/schema";
import {
  createBomItem,
  deleteBomItem
} from "../../src/features/bom_creator/data/mutations";
import { getSymbolBomTemplate } from "../../src/features/bom_creator/data/queries";
import { generateDrawingBom } from "../../src/features/bom_creator/logic/use_cases/generate-drawing-bom";
import {
  BOM_ITEM_KEY_SCOPE,
  parseBomItemKeySequence
} from "../../src/features/bom_creator/logic/services/bom-item-key";

test.describe.configure({ mode: "serial" });

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const itemPrefix = `BOM reliability ${runId}`;
const symbolKey = `bom_reliability_${runId}`;

async function createReliabilityItem(label: string): Promise<BomItemDetail> {
  const item = await createBomItem({
    displayName: `${itemPrefix} ${label}`,
    category: "accessory",
    unit: "each",
    images: []
  });

  if (!item) {
    throw new Error(`Failed to create reliability item: ${label}`);
  }

  return item;
}

async function cleanupReliabilityRecords() {
  await prisma.symbol.deleteMany({ where: { symbolKey } });
  await prisma.bomItem.deleteMany({
    where: { displayName: { startsWith: itemPrefix } }
  });
}

test.afterAll(async () => {
  await cleanupReliabilityRecords();
});

test("keeps generated keys increasing across deletion and concurrent creates", async () => {
  const existingItems = await prisma.bomItem.findMany({
    where: { itemKey: { startsWith: "BOM-" } },
    select: { itemKey: true }
  });
  const highestExisting = existingItems.reduce((highest, item) => {
    const value = parseBomItemKeySequence(item.itemKey);
    return value === null ? highest : Math.max(highest, value);
  }, 0);
  const sequence = await prisma.bomItemKeySequence.findUnique({
    where: { scope: BOM_ITEM_KEY_SCOPE }
  });

  expect(sequence, "BOM item sequence must be initialized by db:setup").not.toBeNull();
  expect(sequence?.lastValue).toBeGreaterThanOrEqual(highestExisting);

  const first = await createReliabilityItem("first");
  const deletedHighest = await createReliabilityItem("deleted-highest");
  const deletedSequence = parseBomItemKeySequence(deletedHighest.itemKey);

  expect(parseBomItemKeySequence(first.itemKey)).not.toBeNull();
  expect(deletedSequence).not.toBeNull();
  await expect(deleteBomItem(deletedHighest.id)).resolves.toEqual({
    id: deletedHighest.id,
    mode: "deleted"
  });
  await expect(
    prisma.bomItem.findUnique({ where: { id: deletedHighest.id } })
  ).resolves.toBeNull();

  const replacement = await createReliabilityItem("replacement");
  const replacementSequence = parseBomItemKeySequence(replacement.itemKey);

  expect(replacement.itemKey).not.toBe(deletedHighest.itemKey);
  expect(replacementSequence).not.toBeNull();
  expect(replacementSequence!).toBeGreaterThan(deletedSequence!);

  const concurrent = await Promise.all([
    createReliabilityItem("concurrent-a"),
    createReliabilityItem("concurrent-b")
  ]);
  const concurrentSequences = concurrent
    .map((item) => parseBomItemKeySequence(item.itemKey))
    .filter((value): value is number => value !== null)
    .sort((firstValue, secondValue) => firstValue - secondValue);

  expect(new Set(concurrent.map((item) => item.itemKey)).size).toBe(2);
  expect(concurrentSequences).toHaveLength(2);
  expect(concurrentSequences[0]).toBeGreaterThan(replacementSequence!);
  expect(concurrentSequences[1]).toBeGreaterThan(concurrentSequences[0]);
});

test("archives referenced items and retains archived-item generation warnings", async () => {
  const item = await createReliabilityItem("referenced");
  const symbol = await prisma.symbol.create({
    data: {
      symbolKey,
      displayName: `BOM Reliability Symbol ${runId}`,
      category: "instrument",
      status: "approved"
    }
  });
  const template = await prisma.symbolBomTemplate.create({
    data: {
      symbolId: symbol.id,
      lines: {
        create: {
          itemId: item.id,
          lineNumber: 1,
          quantityRule: "fixed_per_assembly",
          quantity: 1
        }
      }
    },
    include: { lines: true }
  });

  await expect(deleteBomItem(item.id)).resolves.toEqual({
    id: item.id,
    mode: "archived"
  });

  const [archivedItem, retainedLine, templateDetail] = await Promise.all([
    prisma.bomItem.findUnique({ where: { id: item.id } }),
    prisma.symbolBomTemplateLine.findUnique({
      where: {
        templateId_lineNumber: {
          templateId: template.id,
          lineNumber: 1
        }
      }
    }),
    getSymbolBomTemplate(symbol.id)
  ]);

  expect(archivedItem?.status).toBe("archived");
  expect(retainedLine?.itemId).toBe(item.id);
  expect(templateDetail).not.toBeNull();

  const defaultModel = createDefaultDrawingModel();
  const model: DrawingModel = {
    ...defaultModel,
    assets: [
      {
        id: `asset_${runId}`,
        tag: `REL-${runId}`,
        type: "instrument",
        title: "Reliability instrument",
        symbolId: symbol.id,
        versionId: `version_${runId}`
      }
    ],
    sheets: [
      {
        ...defaultModel.sheets[0],
        placements: [
          {
            id: `placement_${runId}`,
            assetId: `asset_${runId}`,
            symbolId: symbol.id,
            versionId: `version_${runId}`,
            role: "device",
            tag: `REL-${runId}`,
            title: "Reliability instrument",
            x: 20,
            y: 20,
            rotation: 0,
            scale: 1
          }
        ]
      }
    ]
  };
  const bom = generateDrawingBom({
    drawingId: `drawing_${runId}`,
    drawingTitle: "Reliability drawing",
    model,
    symbols: [],
    templates: [templateDetail!]
  });

  expect(bom.assemblies[0]?.lines).toHaveLength(1);
  expect(bom.assemblies[0]?.lines[0]?.itemId).toBe(item.id);
  expect(bom.warnings.map((warning) => warning.code)).toContain("archived_item");
});

test("uses the same image path and capacity accounting for upload and paste", async ({
  page
}) => {
  await page.goto("/bom/items");
  await page.getByRole("button", { name: "New item" }).click();
  await page.locator("#bom-display-name").fill(`${itemPrefix} image-preview`);
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: `upload-${runId}.png`,
    mimeType: "image/png",
    buffer: Buffer.alloc(1024)
  });
  await expect(page.getByText(`upload-${runId}.png`)).toBeVisible();

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
      base64: Buffer.alloc(1024).toString("base64"),
      fileName: `pasted-${runId}.png`
    }
  );

  await expect(page.getByText(`pasted-${runId}.png`)).toBeVisible();
  await expect(page.getByTestId("bom-item-image-dropzone")).toContainText(
    "2 / 12 images. 2 KB / 20 MB used."
  );
  await page.getByRole("button", { name: "Close item wizard" }).click();
});
