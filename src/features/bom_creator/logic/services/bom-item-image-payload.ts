import { createHash } from "node:crypto";
import type { BomItemImagePayload } from "../../data/schema";
import {
  dataUrlByteLength,
  dataUrlMimeType
} from "./bom-item-image-budget";

export type StoredBomItemImagePayload = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export function buildBomItemImagePayload(
  image: StoredBomItemImagePayload
): BomItemImagePayload {
  const dataUrlType = dataUrlMimeType(image.dataUrl);
  const contentLength = dataUrlByteLength(image.dataUrl);

  if (!dataUrlType || contentLength === null) {
    throw new Error(`BOM item image ${image.id} has invalid stored image data.`);
  }

  if (dataUrlType !== image.mimeType.toLowerCase()) {
    throw new Error(`BOM item image ${image.id} has mismatched stored MIME data.`);
  }

  if (contentLength !== image.sizeBytes) {
    throw new Error(`BOM item image ${image.id} has mismatched stored size data.`);
  }

  const encodedData = image.dataUrl.slice(image.dataUrl.indexOf(",") + 1);
  const buffer = Buffer.from(encodedData, "base64");
  const bytes = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(bytes).set(buffer);
  const digest = createHash("sha256")
    .update(buffer)
    .digest("base64url");

  return {
    id: image.id,
    bytes,
    mimeType: dataUrlType,
    contentLength,
    etag: `"sha256-${digest}"`
  };
}
