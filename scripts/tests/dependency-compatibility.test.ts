import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ExcelJS from "exceljs";
import { loadConfigFromFile } from "@prisma/config";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("security dependency integration compatibility", () => {
  it("loads the actual Prisma configuration without connecting to a database", async () => {
    const configRoot = fileURLToPath(new URL("./fixtures/security/", import.meta.url));
    const result = await loadConfigFromFile({ configRoot, configFile: "prisma.config.ts" });
    expect(result.error).toBeUndefined();
    expect(result.config?.schema).toBe(path.join(configRoot, "schema.prisma"));
    expect(result.config?.migrations).toEqual({
      path: path.join(configRoot, "migrations"), seed: "echo synthetic-seed"
    });
  });

  it("preserves the plain configuration merge semantics used by Prisma", () => {
    const prismaRequire = createRequire(require.resolve("@prisma/config"));
    const { deepmerge } = prismaRequire("deepmerge-ts") as {
      deepmerge: (...values: unknown[]) => unknown;
    };
    const left = { migrations: { path: "migrations" }, list: ["one"] };
    const right = { migrations: { seed: "seed" }, list: ["two"] };
    expect(deepmerge(left, right)).toEqual({
      migrations: { path: "migrations", seed: "seed" }, list: ["one", "two"]
    });
    expect(left).toEqual({ migrations: { path: "migrations" }, list: ["one"] });
    expect(right).toEqual({ migrations: { seed: "seed" }, list: ["two"] });
  });

  it("preserves ExcelJS CommonJS v4 UUID usage and extended-format XLSX round trips", async () => {
    const excelRequire = createRequire(require.resolve("exceljs"));
    const { v4, validate, version } = excelRequire("uuid") as {
      v4: () => string; validate: (id: string) => boolean; version: (id: string) => number;
    };
    const id = v4();
    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(4);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Synthetic engineering");
    sheet.addRows([["Tag", "Wire"], ["TB-101", "001"], ["TB-102", "002"]]);
    // This extended icon set exercises ExcelJS's actual UUID-dependent serializer.
    sheet.addConditionalFormatting({ ref: "B2:B3", rules: [{
      type: "iconSet", iconSet: "3Stars", priority: 1,
      cfvo: [{ type: "percent", value: 0 }, { type: "percent", value: 33 }, { type: "percent", value: 67 }]
    }] });
    const bytes = await workbook.xlsx.writeBuffer();
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(bytes);
    expect(restored.getWorksheet(1)?.getCell("A2").value).toBe("TB-101");
    expect(restored.getWorksheet(1)?.getCell("B2").value).toBe("001");
    // ExcelJS exposes this at runtime but omits it from its Worksheet declaration.
    const restoredFormatting: unknown = restored.getWorksheet(1);
    expect(restoredFormatting).toMatchObject({
      conditionalFormattings: [{ rules: [{ type: "iconSet", iconSet: "3Stars" }] }]
    });
  });
});
