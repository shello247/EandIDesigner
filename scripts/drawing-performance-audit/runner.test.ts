import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { resolveAuditConfiguration } from "./run-config.mjs";

const phase = `runner-contract-${process.pid}-${Date.now()}`;
const configuration = resolveAuditConfiguration(process.cwd(), phase);
const resultSchema = z.object({
  exitCode: z.number().nullable(), sourceDrift: z.boolean(),
  error: z.string().optional(), sourceState: z.object({ sourceFingerprint: z.string() })
});
function invoke(label: string, command: string, args: string[] = []) {
  return spawnSync(process.execPath, [
    "scripts/drawing-performance-audit/run-command.mjs", label, command, ...args
  ], { cwd: configuration.root, env: { ...process.env, AUDIT_PHASE: phase }, encoding: "utf8" });
}
function result(label: string) {
  return resultSchema.parse(JSON.parse(fs.readFileSync(path.join(configuration.output, `${label}-result.json`), "utf8")));
}

describe("guarded command evidence", () => {
  it("records successful runs and drains output before completing", () => {
    expect(invoke("success", process.execPath, ["-e", "process.stdout.write('x'.repeat(65536))"]).status).toBe(0);
    expect(result("success")).toMatchObject({ exitCode: 0, sourceDrift: false });
    expect(fs.readFileSync(path.join(configuration.output, "success.log"), "utf8")).toHaveLength(65536);
  });

  it("retains the first attempt and refuses a duplicate label", () => {
    expect(invoke("unique", process.execPath, ["-e", "console.log('first')"]).status).toBe(0);
    const original = fs.readFileSync(path.join(configuration.output, "unique-result.json"), "utf8");
    expect(invoke("unique", process.execPath, ["-e", "console.log('replacement')"]).status).not.toBe(0);
    expect(fs.readFileSync(path.join(configuration.output, "unique-result.json"), "utf8")).toBe(original);
    expect(fs.readFileSync(path.join(configuration.output, "unique.log"), "utf8")).toBe("first\n");
  });

  it("records an executable launch failure", () => {
    expect(invoke("missing", path.join(configuration.root, "not-an-audit-executable")).status).not.toBe(0);
    expect(result("missing")).toMatchObject({ exitCode: 1, sourceDrift: false });
    expect(result("missing").error).toContain("ENOENT");
    expect(fs.existsSync(path.join(configuration.output, "missing-start.json"))).toBe(true);
  });

  it.runIf(process.platform === "win32")("records Windows synchronous batch launch failure", () => {
    expect(invoke("batch", "npm.cmd", ["--version"]).status).not.toBe(0);
    expect(result("batch")).toMatchObject({ exitCode: 1, sourceDrift: false });
    expect(result("batch").error).toContain("EINVAL");
    expect(fs.existsSync(path.join(configuration.output, "batch-start.json"))).toBe(true);
  });
});
