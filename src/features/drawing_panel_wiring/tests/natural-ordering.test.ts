import { describe, expect, it } from "vitest";
import { compareNaturalIdentifiers } from "../logic/services/natural-ordering";

const identifiers = [
  "",
  "0",
  "00",
  "01",
  "1",
  "2",
  "02",
  "2a",
  "2A",
  "10",
  "T1",
  "T01",
  "T1.2",
  "T1.02",
  "T1.10",
  "T2",
  "T10",
  "a",
  "A",
  "á",
  "ä",
  "e\u0301",
  "é",
  "a-2",
  "a_2",
  "a:2",
  "a%202",
  "Ω2",
  "Ω10",
  "😀2",
  "😀10"
];

describe("natural engineering identifier ordering", () => {
  it("is sign-equivalent to numeric localeCompare for adversarial values", () => {
    for (const first of identifiers) {
      for (const second of identifiers) {
        expect(Math.sign(compareNaturalIdentifiers(first, second))).toBe(
          Math.sign(
            first.localeCompare(second, undefined, { numeric: true })
          )
        );
      }
    }
  });

  it("retains numeric rather than lexical order", () => {
    expect(["T10", "T2", "T1"].sort(compareNaturalIdentifiers)).toEqual([
      "T1",
      "T2",
      "T10"
    ]);
  });
});
