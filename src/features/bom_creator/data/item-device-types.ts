import { Prisma } from "@prisma/client";
import { DEVICE_TYPE_OPTIONS } from "@/shared/device-classification/device-types";
import { prisma } from "@/lib/prisma";
import { getItemEngineeringRevisions } from "@/features/item_engineering/api/server";
import { getItemDeviceTypeLabel, itemEngineeringDeviceTypeSchema } from "@/features/item_engineering/api/public";
import type { BomItemListInput } from "./schema";

export const UNCLASSIFIED_ITEM_DEVICE_TYPE = "unclassified";

// Keep the owner and ordering key for Prisma's batched nested-take projection.
// The relation is stripped from the public catalogue DTO below.
export const itemDeviceTypeRevisionSelect = {
  orderBy: { revisionNumber: "desc" as const }, take: 1, select: { id: true, itemId: true, revisionNumber: true }
};

type ItemWithRevision = { id: string; category: string; engineeringRevisions: { id: string }[] };

export async function projectItemDeviceTypes<T extends ItemWithRevision>(
  rows: readonly T[], db: Prisma.TransactionClient = prisma
): Promise<Omit<T, "engineeringRevisions">[]> {
  const ids = [...new Set(rows.flatMap(row => row.engineeringRevisions.map(revision => revision.id)))];
  const types = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 1000) {
    const revisions = await getItemEngineeringRevisions(ids.slice(offset, offset + 1000), db);
    for (const revision of revisions) types.set(revision.id, revision.profile.deviceType);
  }
  return rows.map(({ engineeringRevisions, ...row }) => {
    const revisionId = engineeringRevisions[0]?.id;
    const deviceType = revisionId ? types.get(revisionId) : UNCLASSIFIED_ITEM_DEVICE_TYPE;
    if (!deviceType) throw new Error("The selected Item engineering revision could not be loaded. Refresh and retry.");
    // Legacy catalogue labels are deliberately not interpreted as engineering classifications.
    return { ...row, category: deviceType };
  });
}

const latestRevisionJoin = Prisma.sql`LEFT JOIN "BomItemEngineeringRevision" r ON r."id" = (
  SELECT latest."id" FROM "BomItemEngineeringRevision" latest
  WHERE latest."itemId" = i."id" ORDER BY latest."revisionNumber" DESC LIMIT 1
)`;

// The legacy query parameter remains compatible; its value now identifies the single Device Type.
// Bound SQL keeps filtering/counting paginated without loading every profile into application memory.
export async function listItemDeviceTypePage(input: BomItemListInput, db: Prisma.TransactionClient = prisma) {
  const parsedType = itemEngineeringDeviceTypeSchema.safeParse(input.category);
  if (!parsedType.success && input.category !== UNCLASSIFIED_ITEM_DEVICE_TYPE) return { ids: [], totalItems: 0, page: 1 };
  const clauses = [Prisma.sql`i."status" = 'active'`];
  clauses.push(input.category === UNCLASSIFIED_ITEM_DEVICE_TYPE
    ? Prisma.sql`r."id" IS NULL`
    : Prisma.sql`json_extract(r."profileJson", '$.deviceType') = ${parsedType.data!}`);
  if (input.manufacturer) clauses.push(Prisma.sql`i."manufacturer" = ${input.manufacturer}`);
  if (input.query) {
    const query = `%${input.query}%`;
    clauses.push(Prisma.sql`(i."itemKey" LIKE ${query} OR i."displayName" LIKE ${query}
      OR i."partNumber" LIKE ${query} OR i."manufacturer" LIKE ${query} OR i."supplierName" LIKE ${query})`);
  }
  const where = Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}`;
  const [count] = await db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS count FROM "BomItem" i ${latestRevisionJoin} ${where}`);
  const totalItems = Number(count.count);
  const page = Math.min(input.page, Math.max(1, Math.ceil(totalItems / input.pageSize)));
  const rows = totalItems === 0 ? [] : await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT i."id" FROM "BomItem" i ${latestRevisionJoin} ${where}
    ORDER BY i."displayName" ASC, i."itemKey" ASC
    LIMIT ${input.pageSize} OFFSET ${(page - 1) * input.pageSize}`);
  return { ids: rows.map(row => row.id), totalItems, page };
}

export async function listItemDeviceTypeOptions(db: Prisma.TransactionClient = prisma) {
  const rows = await db.$queryRaw<{ deviceType: string | null }[]>(Prisma.sql`
    SELECT DISTINCT json_extract(r."profileJson", '$.deviceType') AS deviceType
    FROM "BomItem" i ${latestRevisionJoin} WHERE i."status" = 'active'`);
  return rows.map(row => {
    const type = row.deviceType === null ? null : itemEngineeringDeviceTypeSchema.parse(row.deviceType);
    return { value: type ?? UNCLASSIFIED_ITEM_DEVICE_TYPE, label: getItemDeviceTypeLabel(type) };
  }).sort((first, second) => {
    const order = [...DEVICE_TYPE_OPTIONS.map(type => type.value as string), UNCLASSIFIED_ITEM_DEVICE_TYPE];
    return order.indexOf(first.value) - order.indexOf(second.value);
  });
}
