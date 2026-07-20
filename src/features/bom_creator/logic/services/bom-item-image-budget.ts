export const MAX_BOM_ITEM_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BOM_ITEM_IMAGES = 12;
export const MAX_BOM_ITEM_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;

export type BomItemImageBudgetEntry = {
  sizeBytes: number;
  dataUrl?: string;
};

export type BomItemImageBudgetViolationCode =
  | "too_many_images"
  | "image_too_large"
  | "total_too_large"
  | "invalid_data_url"
  | "size_mismatch";

export type BomItemImageBudgetViolation = {
  code: BomItemImageBudgetViolationCode;
  message: string;
  imageIndex?: number;
};

export type BomItemImageBudgetResult = {
  ok: boolean;
  totalBytes: number;
  violations: BomItemImageBudgetViolation[];
};

const IMAGE_DATA_URL_PATTERN =
  /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i;

function formatMegabytes(bytes: number): string {
  return `${bytes / (1024 * 1024)} MB`;
}

export function dataUrlByteLength(dataUrl: string): number | null {
  const match = IMAGE_DATA_URL_PATTERN.exec(dataUrl);

  if (!match || match[2].length === 0 || match[2].length % 4 === 1) {
    return null;
  }

  const payload = match[2];
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;

  return Math.floor((payload.length * 3) / 4) - padding;
}

export function dataUrlMimeType(dataUrl: string): string | null {
  const match = IMAGE_DATA_URL_PATTERN.exec(dataUrl);

  return match ? match[1].toLowerCase() : null;
}

export function validateBomItemImageBudget(
  images: readonly BomItemImageBudgetEntry[]
): BomItemImageBudgetResult {
  const violations: BomItemImageBudgetViolation[] = [];
  const totalBytes = images.reduce(
    (total, image) => total + Math.max(0, image.sizeBytes),
    0
  );

  if (images.length > MAX_BOM_ITEM_IMAGES) {
    violations.push({
      code: "too_many_images",
      message: `Items can store up to ${MAX_BOM_ITEM_IMAGES} images.`
    });
  }

  images.forEach((image, imageIndex) => {
    if (image.sizeBytes > MAX_BOM_ITEM_IMAGE_BYTES) {
      violations.push({
        code: "image_too_large",
        message: `Each image must be ${formatMegabytes(
          MAX_BOM_ITEM_IMAGE_BYTES
        )} or smaller.`,
        imageIndex
      });
    }

    if (image.dataUrl === undefined) {
      return;
    }

    const decodedBytes = dataUrlByteLength(image.dataUrl);

    if (decodedBytes === null) {
      violations.push({
        code: "invalid_data_url",
        message: "BOM item images must use base64 image data URLs.",
        imageIndex
      });
      return;
    }

    if (decodedBytes !== image.sizeBytes) {
      violations.push({
        code: "size_mismatch",
        message: "BOM item image size does not match its stored image data.",
        imageIndex
      });
    }
  });

  if (totalBytes > MAX_BOM_ITEM_TOTAL_IMAGE_BYTES) {
    violations.push({
      code: "total_too_large",
      message: `Images can use up to ${formatMegabytes(
        MAX_BOM_ITEM_TOTAL_IMAGE_BYTES
      )} in total.`
    });
  }

  return {
    ok: violations.length === 0,
    totalBytes,
    violations
  };
}
