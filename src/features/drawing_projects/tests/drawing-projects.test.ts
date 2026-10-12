import { describe, expect, it } from "vitest";
import {
  createDrawingProjectInputSchema,
  drawingDescriptionSchema,
  drawingProjectStatusSchema,
  formatDrawingProjectNumber,
  parseDrawingProjectNumberSequence,
  normalizeDrawingProjectNumber
} from "../api/public";

describe("drawing project contracts", () => {
  it("normalizes optional project numbers case-insensitively", () => {
    expect(normalizeDrawingProjectNumber("  PLC-2026-A  ")).toBe("plc-2026-a");
    expect(normalizeDrawingProjectNumber("   ")).toBeUndefined();
    expect(normalizeDrawingProjectNumber(undefined)).toBeUndefined();
  });

  it("trims valid Project identity values", () => {
    expect(
      createDrawingProjectInputSchema.parse({
        name: "  North Oropouche Upgrade  ",
        clientId: "  client_1  ",
        description: "  Controls upgrade  "
      })
    ).toEqual({
      name: "North Oropouche Upgrade",
      clientId: "client_1",
      description: "Controls upgrade"
    });
  });

  it("formats and parses automatic Project numbers", () => {
    expect(formatDrawingProjectNumber(1)).toBe("PRJ-000001");
    expect(formatDrawingProjectNumber(42)).toBe("PRJ-000042");
    expect(parseDrawingProjectNumberSequence("PRJ-000042")).toBe(42);
    expect(parseDrawingProjectNumberSequence("legacy-42")).toBeNull();
    expect(() => formatDrawingProjectNumber(0)).toThrow();
  });

  it("rejects invalid lengths and status values", () => {
    expect(() => createDrawingProjectInputSchema.parse({ name: "" })).toThrow();
    expect(() =>
      drawingDescriptionSchema.parse("x".repeat(501))
    ).toThrow();
    expect(() => drawingProjectStatusSchema.parse("deleted")).toThrow();
  });
});
