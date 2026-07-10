import { prisma } from "@/lib/prisma";
import {
  createNetworkMapInputSchema,
  createDefaultNetworkMapModel,
  saveNetworkMapInputSchema,
  stringifyNetworkMapModel,
  type CreateNetworkMapInput,
  type SaveNetworkMapInput
} from "./schema";
import { getNetworkMapDetail } from "./queries";

function normalizeMapKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "network_map";
}

async function nextUniqueMapKey(baseValue: string): Promise<string> {
  const baseKey = normalizeMapKey(baseValue);
  let candidate = baseKey;
  let suffix = 2;

  while (
    await prisma.networkMap.findUnique({
      where: { mapKey: candidate },
      select: { id: true }
    })
  ) {
    candidate = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createNetworkMap(input: CreateNetworkMapInput) {
  const parsed = createNetworkMapInputSchema.parse(input);
  const mapKey = await nextUniqueMapKey(parsed.mapKey ?? parsed.title);
  const model = createDefaultNetworkMapModel();

  const row = await prisma.networkMap.create({
    data: {
      mapKey,
      title: parsed.title,
      status: "draft",
      modelJson: stringifyNetworkMapModel(model)
    }
  });

  return getNetworkMapDetail(row.id);
}

export async function saveNetworkMap(input: SaveNetworkMapInput) {
  const parsed = saveNetworkMapInputSchema.parse(input);

  await prisma.networkMap.update({
    where: { id: parsed.networkMapId },
    data: {
      title: parsed.title,
      status: "needs_review",
      modelJson: stringifyNetworkMapModel(parsed.model)
    }
  });

  return getNetworkMapDetail(parsed.networkMapId);
}

export async function approveNetworkMap(networkMapId: string) {
  await prisma.networkMap.update({
    where: { id: networkMapId },
    data: { status: "approved" }
  });

  return getNetworkMapDetail(networkMapId);
}

export async function deleteNetworkMap(networkMapId: string) {
  await prisma.networkMap.delete({
    where: { id: networkMapId }
  });
}
