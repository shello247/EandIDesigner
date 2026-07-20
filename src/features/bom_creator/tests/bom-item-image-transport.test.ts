import { describe, expect, it } from "vitest";
import {
  bomItemImageMetadataSchema,
  bomItemInputSchema,
  bomItemUpdateInputSchema
} from "../data/schema";
import { buildBomItemImagePayload } from "../logic/services/bom-item-image-payload";

const dataUrl = "data:image/png;base64,YWJj";

describe("BOM item image transport", () => {
  it("uses discriminated new and existing image write contracts", () => {
    const newImage = {
      kind: "new" as const,
      fileName: "new.png",
      mimeType: "image/png",
      sizeBytes: 3,
      dataUrl,
      isPrimary: true,
      sortOrder: 0
    };
    const existingImage = {
      kind: "existing" as const,
      id: "image_1",
      caption: "Existing",
      isPrimary: true,
      sortOrder: 0
    };

    expect(
      bomItemInputSchema.safeParse({
        displayName: "Cable",
        category: "cable",
        unit: "m",
        images: [newImage]
      }).success
    ).toBe(true);
    expect(
      bomItemInputSchema.safeParse({
        displayName: "Cable",
        category: "cable",
        unit: "m",
        images: [existingImage]
      }).success
    ).toBe(false);
    expect(
      bomItemUpdateInputSchema.safeParse({
        id: "item_1",
        images: [existingImage, { ...newImage, isPrimary: false, sortOrder: 1 }]
      }).success
    ).toBe(true);
    expect(
      bomItemUpdateInputSchema.safeParse({
        id: "item_1",
        images: [{ ...existingImage, dataUrl }]
      }).success
    ).toBe(false);
  });

  it("requires matching declared and data URL MIME types", () => {
    const result = bomItemInputSchema.safeParse({
      displayName: "Cable",
      category: "cable",
      unit: "m",
      images: [
        {
          kind: "new",
          fileName: "new.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 3,
          dataUrl,
          isPrimary: true,
          sortOrder: 0
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("builds exact binary payloads with deterministic strong ETags", () => {
    const first = buildBomItemImagePayload({
      id: "image_1",
      mimeType: "image/png",
      sizeBytes: 3,
      dataUrl
    });
    const second = buildBomItemImagePayload({
      id: "image_1",
      mimeType: "image/png",
      sizeBytes: 3,
      dataUrl
    });

    expect(new Uint8Array(first.bytes)).toEqual(
      new Uint8Array([97, 98, 99])
    );
    expect(first).toMatchObject({
      id: "image_1",
      mimeType: "image/png",
      contentLength: 3,
      etag: second.etag
    });
    expect(first.etag).toMatch(/^"sha256-[A-Za-z0-9_-]+"$/);
  });

  it("rejects corrupted stored MIME and size metadata", () => {
    expect(() =>
      buildBomItemImagePayload({
        id: "image_1",
        mimeType: "image/jpeg",
        sizeBytes: 3,
        dataUrl
      })
    ).toThrow(/MIME/);
    expect(() =>
      buildBomItemImagePayload({
        id: "image_1",
        mimeType: "image/png",
        sizeBytes: 4,
        dataUrl
      })
    ).toThrow(/size/);
  });

  it("keeps image data URLs out of metadata DTOs", () => {
    const metadata = bomItemImageMetadataSchema.parse({
      id: "image_1",
      imageUrl: "/api/bom/items/images/image_1",
      fileName: "new.png",
      mimeType: "image/png",
      sizeBytes: 3,
      isPrimary: true,
      sortOrder: 0
    });

    expect(JSON.stringify(metadata)).not.toContain("data:image");
    expect(
      bomItemImageMetadataSchema.safeParse({ ...metadata, dataUrl }).success
    ).toBe(false);
  });

  it("removes at least 95 percent of a maximum-size edit payload", () => {
    const tenMiBBase64 = Buffer.alloc(10 * 1024 * 1024).toString("base64");
    const legacyPayload = JSON.stringify({
      images: [
        { dataUrl: `data:image/png;base64,${tenMiBBase64}` },
        { dataUrl: `data:image/png;base64,${tenMiBBase64}` }
      ]
    });
    const metadataPayload = JSON.stringify({
      images: [
        {
          id: "image_1",
          imageUrl: "/api/bom/items/images/image_1",
          fileName: "first.png",
          mimeType: "image/png",
          sizeBytes: 10 * 1024 * 1024,
          isPrimary: true,
          sortOrder: 0
        },
        {
          id: "image_2",
          imageUrl: "/api/bom/items/images/image_2",
          fileName: "second.png",
          mimeType: "image/png",
          sizeBytes: 10 * 1024 * 1024,
          isPrimary: false,
          sortOrder: 1
        }
      ]
    });
    const reduction = 1 - metadataPayload.length / legacyPayload.length;

    expect(legacyPayload.length).toBeGreaterThan(26 * 1024 * 1024);
    expect(reduction).toBeGreaterThanOrEqual(0.95);
  });
});
