import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "../data/schema";
import { validateSymbolElectricalTopology } from "../logic/services/symbol-electrical-topology";

function metadata(): SymbolMetadata {
  return {
    symbolKey: "pdb_13_way",
    displayName: "13-way Distribution Block",
    category: "terminal_block",
    viewBox: { x: 0, y: 0, width: 100, height: 180 },
    anchors: ["a", "b", "c"].map((key, index) => ({
      key,
      kind: "terminal" as const,
      x: 10 + index * 20,
      y: 20
    })),
    terminals: ["a", "b", "c"].map((key) => ({
      key,
      label: key.toUpperCase(),
      anchorKey: key,
      electricalDomains: ["power" as const],
      requiredForWiring: false
    })),
    electricalTopology: {
      version: 1,
      permanentContinuityGroups: [
        {
          key: "factory_bus",
          label: "Factory copper bus",
          terminalKeys: ["a", "b", "c"]
        }
      ]
    }
  };
}

describe("symbol electrical topology", () => {
  it("accepts a valid permanent continuity group", () => {
    expect(validateSymbolElectricalTopology(metadata())).toMatchObject({
      valid: true,
      topology: {
        version: 1,
        permanentContinuityGroups: [
          { key: "factory_bus", terminalKeys: ["a", "b", "c"] }
        ]
      }
    });
  });

  it.each([
    {
      name: "missing terminal",
      mutate: (value: SymbolMetadata) => {
        value.electricalTopology!.permanentContinuityGroups[0].terminalKeys = [
          "a",
          "missing"
        ];
      }
    },
    {
      name: "duplicate terminal membership",
      mutate: (value: SymbolMetadata) => {
        value.electricalTopology!.permanentContinuityGroups.push({
          key: "other_bus",
          terminalKeys: ["a", "b"]
        });
      }
    },
    {
      name: "duplicate group key",
      mutate: (value: SymbolMetadata) => {
        value.electricalTopology!.permanentContinuityGroups.push({
          key: "factory_bus",
          terminalKeys: ["a", "b"]
        });
      }
    }
  ])("rejects $name", ({ mutate }) => {
    const value = metadata();
    mutate(value);
    expect(validateSymbolElectricalTopology(value).valid).toBe(false);
  });

  it("rejects explicitly incompatible electrical domains", () => {
    const value = metadata();
    value.terminals[1].electricalDomains = ["signal"];
    expect(validateSymbolElectricalTopology(value)).toMatchObject({
      valid: false,
      issues: [expect.stringContaining("incompatible electrical domains")]
    });
  });

  it("does not infer topology from Function text", () => {
    const value = metadata();
    value.electricalTopology = undefined;
    value.terminals.forEach((terminal) => {
      terminal.function = "Internally common";
    });
    expect(validateSymbolElectricalTopology(value)).toMatchObject({
      valid: true,
      topology: undefined
    });
  });
});
