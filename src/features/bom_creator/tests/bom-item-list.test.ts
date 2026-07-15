import { describe, expect, it } from "vitest";
import {
  BOM_ITEM_LIST_DEFAULT_PAGE_SIZE,
  BOM_ITEM_LIST_MAX_PAGE_SIZE,
  bomItemListInputSchema,
  bomItemListRowSchema
} from "../data/schema";
import {
  buildBomItemListUrl,
  hasBomItemFilters,
  parseBomItemListSearchParams
} from "../logic/services/bom-item-list-url";

describe("BOM item list scalability contracts", () => {
  it("applies bounded pagination defaults", () => {
    expect(bomItemListInputSchema.parse({})).toEqual({
      page: 1,
      pageSize: BOM_ITEM_LIST_DEFAULT_PAGE_SIZE
    });
    expect(
      bomItemListInputSchema.parse({ page: "0", pageSize: "101" })
    ).toMatchObject({ page: 1, pageSize: BOM_ITEM_LIST_DEFAULT_PAGE_SIZE });
    expect(
      bomItemListInputSchema.parse({ page: "2", pageSize: "100" })
    ).toMatchObject({ page: 2, pageSize: BOM_ITEM_LIST_MAX_PAGE_SIZE });
  });

  it("normalizes URL query arrays, whitespace, and empty filters", () => {
    expect(
      parseBomItemListSearchParams({
        q: ["  CABLE  ", "ignored"],
        category: "  cable  ",
        manufacturer: "",
        page: "3",
        pageSize: "25"
      })
    ).toEqual({
      query: "CABLE",
      category: "cable",
      page: 3,
      pageSize: 25
    });
  });

  it("rejects unknown and over-length list input fields", () => {
    expect(
      bomItemListInputSchema.safeParse({ query: "x".repeat(121) }).success
    ).toBe(false);
    expect(
      bomItemListInputSchema.safeParse({ category: "x".repeat(161) }).success
    ).toBe(false);
    expect(
      bomItemListInputSchema.safeParse({ page: 1, unsupported: true }).success
    ).toBe(false);
  });

  it("builds canonical URLs that preserve filters and omit defaults", () => {
    expect(
      buildBomItemListUrl({ filters: {}, page: 1, pageSize: 50 })
    ).toBe("/bom/items");
    expect(
      buildBomItemListUrl({
        filters: {
          query: "Cable Gland",
          category: "cable_gland",
          manufacturer: "ACME"
        },
        page: 2,
        pageSize: 25
      })
    ).toBe(
      "/bom/items?q=Cable+Gland&category=cable_gland&manufacturer=ACME&page=2&pageSize=25"
    );
  });

  it("detects active filters", () => {
    expect(hasBomItemFilters({})).toBe(false);
    expect(hasBomItemFilters({ manufacturer: "ACME" })).toBe(true);
  });

  it("keeps the table DTO lean and strict", () => {
    const row = {
      id: "item_1",
      itemKey: "BOM-000001",
      displayName: "Cable",
      category: "cable",
      unit: "m",
      templateLineCount: 0
    };

    expect(bomItemListRowSchema.parse(row)).toEqual(row);
    expect(
      bomItemListRowSchema.safeParse({
        ...row,
        description: "Detail-only field"
      }).success
    ).toBe(false);
    expect(
      bomItemListRowSchema.safeParse({
        ...row,
        images: [{ dataUrl: "data:image/png;base64,YWJj" }]
      }).success
    ).toBe(false);
  });
});
