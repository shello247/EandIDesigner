import { describe, expect, it } from "vitest";
import {
  bomItemInputSchema,
  bomItemUpdateInputSchema
} from "../data/schema";
import {
  MAX_BOM_ITEM_IMAGE_BYTES,
  MAX_BOM_ITEM_IMAGES,
  MAX_BOM_ITEM_TOTAL_IMAGE_BYTES,
  dataUrlByteLength,
  validateBomItemImageBudget
} from "../logic/services/bom-item-image-budget";
import {
  formatBomItemKey,
  parseBomItemKeySequence
} from "../logic/services/bom-item-key";

describe("BOM item reliability", () => {
  it("formats and parses permanent sequential item keys", () => {
    expect(formatBomItemKey(1)).toBe("BOM-000001");
    expect(formatBomItemKey(999999)).toBe("BOM-999999");
    expect(formatBomItemKey(1000000)).toBe("BOM-1000000");
    expect(parseBomItemKeySequence("BOM-000123")).toBe(123);
    expect(parseBomItemKeySequence(" BOM-1000000 ")).toBe(1000000);
  });

  it("rejects malformed or invalid generated item keys", () => {
    expect(parseBomItemKeySequence("BOM-CABLE")).toBeNull();
    expect(parseBomItemKeySequence("bom-000001")).toBeNull();
    expect(parseBomItemKeySequence("BOM-000000")).toBeNull();
    expect(() => formatBomItemKey(0)).toThrow(/positive safe integer/);
    expect(() => formatBomItemKey(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  it("calculates base64 image data sizes without browser-specific APIs", () => {
    expect(dataUrlByteLength("data:image/png;base64,YQ==")).toBe(1);
    expect(dataUrlByteLength("data:image/png;base64,YWI=")).toBe(2);
    expect(dataUrlByteLength("data:image/png;base64,YWJj")).toBe(3);
    expect(dataUrlByteLength("data:text/plain;base64,YWJj")).toBeNull();
    expect(dataUrlByteLength("data:image/png,not-base64")).toBeNull();
  });

  it("validates count, individual size, and aggregate image budgets", () => {
    const tooMany = validateBomItemImageBudget(
      Array.from({ length: MAX_BOM_ITEM_IMAGES + 1 }, () => ({ sizeBytes: 1 }))
    );
    const tooLarge = validateBomItemImageBudget([
      { sizeBytes: MAX_BOM_ITEM_IMAGE_BYTES + 1 }
    ]);
    const overTotal = validateBomItemImageBudget([
      { sizeBytes: MAX_BOM_ITEM_IMAGE_BYTES },
      { sizeBytes: MAX_BOM_ITEM_IMAGE_BYTES },
      { sizeBytes: 1 }
    ]);

    expect(tooMany.violations.map((item) => item.code)).toContain(
      "too_many_images"
    );
    expect(tooLarge.violations.map((item) => item.code)).toContain(
      "image_too_large"
    );
    expect(overTotal.totalBytes).toBe(MAX_BOM_ITEM_TOTAL_IMAGE_BYTES + 1);
    expect(overTotal.violations.map((item) => item.code)).toContain(
      "total_too_large"
    );
  });

  it("rejects invalid data URLs and declared image size mismatches", () => {
    const invalid = validateBomItemImageBudget([
      { sizeBytes: 3, dataUrl: "data:image/png;base64,%%%" }
    ]);
    const mismatch = validateBomItemImageBudget([
      { sizeBytes: 4, dataUrl: "data:image/png;base64,YWJj" }
    ]);
    const valid = validateBomItemImageBudget([
      { sizeBytes: 3, dataUrl: "data:image/png;base64,YWJj" }
    ]);

    expect(invalid.violations.map((item) => item.code)).toContain(
      "invalid_data_url"
    );
    expect(mismatch.violations.map((item) => item.code)).toContain(
      "size_mismatch"
    );
    expect(valid).toMatchObject({ ok: true, totalBytes: 3 });
  });

  it("rejects itemKey in create and update write contracts", () => {
    expect(
      bomItemInputSchema.safeParse({
        itemKey: "BOM-999999",
        displayName: "Cable",
        category: "cable",
        unit: "m"
      }).success
    ).toBe(false);

    expect(
      bomItemUpdateInputSchema.safeParse({
        id: "item_1",
        itemKey: "BOM-999999",
        displayName: "Cable"
      }).success
    ).toBe(false);
  });
});
