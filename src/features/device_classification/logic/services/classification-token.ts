import { createHash } from "node:crypto";

export function classificationContentToken(row: {
  id: string; symbolId: string; versionNumber: number; status: string;
  deviceType: string | null; svg: string; metadataJson: string;
}) {
  return createHash("sha256").update(JSON.stringify([
    row.id, row.symbolId, row.versionNumber, row.status, row.deviceType, row.svg, row.metadataJson
  ])).digest("hex");
}
