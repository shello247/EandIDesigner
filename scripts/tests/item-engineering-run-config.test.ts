import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertAuditDatabase, resolveAuditConfiguration } from "../drawing-performance-audit/run-config.mjs";

describe("Item Engineering isolated runner", () => {
  it("resolves only the registered workspace test database", () => {
    const root = process.cwd();
    // Other worktrees/CI use their own registered audit identity.
    if (path.basename(root) !== "item-engineering") return;
    const config = resolveAuditConfiguration(root, "runner-test", {});
    expect(config.database).toBe(path.join(root, "prisma", "test-item-engineering-baseline.db"));
    expect(config.output).toBe(path.join(root, "artifacts/drawing-performance/item-engineering/runner-test"));
    expect(() => assertAuditDatabase(config, config.databaseUrl)).not.toThrow();
    expect(() => assertAuditDatabase(config, "file:./dev.db")).toThrow("non-isolated");
    expect(() => resolveAuditConfiguration(root, "../escape", {})).toThrow("Invalid audit phase");
  });
});
