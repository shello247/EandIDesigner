import { itemEngineerNoteImageSchema } from "../../data/schema";
import { ItemEngineeringError } from "./item-engineering-revision";

export function validateItemNoteImage(input: unknown) {
  const image = itemEngineerNoteImageSchema.parse(input);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.dataUrl);
  if (!match || match[1] !== image.mimeType) throw new ItemEngineeringError("INVALID_GUIDANCE", "Note image must contain matching base64 PNG, JPEG or WebP data.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.toString("base64") !== match[2] || bytes.length !== image.sizeBytes) {
    throw new ItemEngineeringError("INVALID_GUIDANCE", "Note image size or base64 data is invalid.");
  }
  const matchesSignature = image.mimeType === "image/png"
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : image.mimeType === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!matchesSignature) throw new ItemEngineeringError("INVALID_GUIDANCE", "Note image bytes do not match the declared image type.");
  return image;
}
