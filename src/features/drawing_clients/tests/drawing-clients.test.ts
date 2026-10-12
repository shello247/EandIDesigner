import { describe, expect, it } from "vitest";
import {
  createDrawingClientInputSchema,
  normalizeDrawingClientName
} from "../api/public";

describe("drawing Client contracts", () => {
  it("normalizes names for case-insensitive uniqueness", () => {
    expect(normalizeDrawingClientName("  Water Authority  ")).toBe(
      "water authority"
    );
    expect(normalizeDrawingClientName("WATER AUTHORITY")).toBe(
      "water authority"
    );
  });

  it("trims valid Client names and rejects invalid values", () => {
    expect(
      createDrawingClientInputSchema.parse({ name: "  Water Authority  " })
    ).toEqual({ name: "Water Authority" });
    expect(() => createDrawingClientInputSchema.parse({ name: "" })).toThrow();
    expect(() =>
      createDrawingClientInputSchema.parse({ name: "x".repeat(161) })
    ).toThrow();
  });
});
