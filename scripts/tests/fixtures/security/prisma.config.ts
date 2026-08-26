import { defineConfig } from "prisma/config";

// Configuration parsing only: these synthetic paths are never opened as a database.
export default defineConfig({
  schema: "./schema.prisma",
  migrations: { path: "./migrations", seed: "echo synthetic-seed" }
});
