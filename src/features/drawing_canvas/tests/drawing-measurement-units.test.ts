import { describe, expect, it } from "vitest";
import {
  drawingMeasurementLabel,
  drawingMeasurementToDisplayValue,
  formatDrawingMeasurement,
  formatDrawingMeasurementPair,
  inchesToMillimetres,
  millimetresToInches,
  parseDrawingMeasurement
} from "../logic/services/drawing-measurement-units";

describe("drawing measurement units", () => {
  it("converts exactly between millimetres and decimal inches", () => {
    expect(millimetresToInches(25.4)).toBe(1);
    expect(inchesToMillimetres(1)).toBe(25.4);
    expect(drawingMeasurementToDisplayValue(600, "in")).toBe(23.622);
    expect(parseDrawingMeasurement("24", "in")).toBe(609.6);
  });

  it("formats values without unnecessary trailing zeroes", () => {
    expect(formatDrawingMeasurement(609.6, "mm")).toBe("609.6");
    expect(formatDrawingMeasurement(25.4, "in")).toBe("1");
    expect(formatDrawingMeasurementPair(600, 600, "in")).toBe(
      "23.622 × 23.622 in"
    );
    expect(drawingMeasurementLabel("Width", "mm")).toBe("Width (mm)");
  });

  it("rejects blank, malformed, and non-finite input", () => {
    expect(parseDrawingMeasurement("", "mm")).toBeUndefined();
    expect(parseDrawingMeasurement("not-a-number", "mm")).toBeUndefined();
    expect(parseDrawingMeasurement("0x10", "mm")).toBeUndefined();
    expect(parseDrawingMeasurement("Infinity", "in")).toBeUndefined();
    expect(parseDrawingMeasurement("0", "mm")).toBe(0);
    expect(parseDrawingMeasurement("-1", "mm")).toBe(-1);
  });

  it("does not mutate canonical values while formatting either unit", () => {
    const storedMillimetres = 600;

    expect(formatDrawingMeasurement(storedMillimetres, "in")).toBe("23.622");
    expect(formatDrawingMeasurement(storedMillimetres, "mm")).toBe("600");
    expect(storedMillimetres).toBe(600);
  });

  it("does not drift when the displayed value is switched repeatedly", () => {
    let storedMillimetres = 600;

    for (let index = 0; index < 20; index += 1) {
      const displayedInches = formatDrawingMeasurement(
        storedMillimetres,
        "in"
      );
      storedMillimetres =
        parseDrawingMeasurement(displayedInches, "in") ?? NaN;
      expect(formatDrawingMeasurement(storedMillimetres, "mm")).toBe("600");
    }
  });
});
