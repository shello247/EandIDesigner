import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
// A source fingerprint is provenance, not a trusted test attestation. No environment files are read.
export function standardsBuildId(root = process.cwd()): string {
  const built = path.join(root, ".next", "BUILD_ID");
  if (process.env.NODE_ENV === "production" && existsSync(built)) return "production:" + readFileSync(built, "utf8").trim();
  const hash = createHash("sha256");
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(tsx?|css)$/.test(entry.name)) hash.update(path.relative(root, file)).update(readFileSync(file));
    }
  }
  visit(path.join(root, "src"));
  for (const name of ["package.json", "package-lock.json", "prisma/schema.prisma", "next.config.ts"]) if (existsSync(path.join(root, name))) hash.update(name).update(readFileSync(path.join(root, name)));
  return "development:" + hash.digest("hex");
}

