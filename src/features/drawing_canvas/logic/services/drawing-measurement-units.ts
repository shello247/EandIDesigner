import type { DrawingMeasurementUnit } from "../../data/schema";

export const MILLIMETRES_PER_INCH = 25.4;

function roundMillimetres(value: number): number {
  return Number(value.toFixed(2));
}

function roundForDisplay(
  value: number,
  unit: DrawingMeasurementUnit
): number {
  return Number(value.toFixed(unit === "in" ? 3 : 2));
}

export function millimetresToInches(value: number): number {
  return value / MILLIMETRES_PER_INCH;
}

export function inchesToMillimetres(value: number): number {
  return value * MILLIMETRES_PER_INCH;
}

export function drawingMeasurementToDisplayValue(
  millimetres: number,
  unit: DrawingMeasurementUnit
): number {
  const converted =
    unit === "in" ? millimetresToInches(millimetres) : millimetres;

  return roundForDisplay(converted, unit);
}

export function formatDrawingMeasurement(
  millimetres: number,
  unit: DrawingMeasurementUnit
): string {
  return String(drawingMeasurementToDisplayValue(millimetres, unit));
}

export function parseDrawingMeasurement(
  value: string,
  unit: DrawingMeasurementUnit
): number | undefined {
  const normalized = value.trim();
  if (
    !normalized ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)
  ) {
    return undefined;
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return undefined;

  const millimetres =
    unit === "in" ? inchesToMillimetres(numericValue) : numericValue;

  return roundMillimetres(millimetres);
}

export function drawingMeasurementLabel(
  label: string,
  unit: DrawingMeasurementUnit
): string {
  return `${label} (${unit})`;
}

export function formatDrawingMeasurementPair(
  widthMm: number,
  heightMm: number,
  unit: DrawingMeasurementUnit
): string {
  return `${formatDrawingMeasurement(widthMm, unit)} × ${formatDrawingMeasurement(
    heightMm,
    unit
  )} ${unit}`;
}
