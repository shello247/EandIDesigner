import { prisma } from "@/lib/prisma";

let hasEnsuredTemplateTable = false;

export async function ensureSheetTemplateTable() {
  if (hasEnsuredTemplateTable) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DrawingSheetTemplate" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "templateKey" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "modelJson" TEXT NOT NULL,
      "metadataJson" TEXT NOT NULL,
      "sourceDrawingId" TEXT,
      "sourceSheetId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DrawingSheetTemplate_templateKey_key"
    ON "DrawingSheetTemplate"("templateKey");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DrawingSheetTemplate_status_idx"
    ON "DrawingSheetTemplate"("status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DrawingSheetTemplate_updatedAt_idx"
    ON "DrawingSheetTemplate"("updatedAt");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DrawingSheetTemplate_category_idx"
    ON "DrawingSheetTemplate"("category");
  `);

  hasEnsuredTemplateTable = true;
}
