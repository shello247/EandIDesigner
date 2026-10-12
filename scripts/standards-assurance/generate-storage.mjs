import fs from "node:fs";
const input = fs.readFileSync("artifacts/standards-assurance/schema-all.sql", "utf8");
const statements = input.replace(/--[^\n]*/g, "").split(";").map(s => s.trim()).filter(s => /^CREATE (TABLE|(?:UNIQUE )?INDEX) "Standard/.test(s)).map(s => s.replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ").replace(/^CREATE UNIQUE INDEX /, "CREATE UNIQUE INDEX IF NOT EXISTS ").replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS ") + ";");
if (statements.filter(s => s.startsWith("CREATE TABLE")).length !== 13) throw new Error("Unexpected standards schema");
fs.writeFileSync("src/features/standards_assurance/data/storage-sql.ts", "// Generated from Prisma schema by scripts/standards-assurance/generate-storage.mjs.\nexport const STANDARDS_STORAGE_SQL: readonly string[] = " + JSON.stringify(statements, null, 2) + ";\n");

