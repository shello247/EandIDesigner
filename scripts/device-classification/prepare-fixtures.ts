import { PrismaClient } from "@prisma/client";
import { assertAuditDatabase } from "../drawing-performance-audit/run-config.mjs";

// These are synthetic bootstrap identities, never a production classification rule.
export default async function prepareFixtures() {
  assertAuditDatabase();
  const prisma = new PrismaClient();
  try {
    for (const [symbolKey, deviceType] of [
      ["nmt81_average_temperature_probe", "instrument"],
      ["nrf81_tank_side_monitor", "controller"],
      ["clx_cable_1_pair", "cable"],
      ["miniature_circuit_breaker_3_pole", "breaker"]
    ] as const) {
      const symbol = await prisma.symbol.findUniqueOrThrow({ where: { symbolKey }, select: { id: true } });
      await prisma.symbolVersion.updateMany({ where: { symbolId: symbol.id }, data: { deviceType } });
    }
  } finally {
    await prisma.$disconnect();
  }
}
