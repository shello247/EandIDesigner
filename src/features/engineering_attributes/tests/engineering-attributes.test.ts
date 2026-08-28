import { describe, expect, it } from "vitest";
import {
  ENGINEERING_ATTRIBUTE_DEFINITIONS,
  cloneEngineeringAttributesForNewAsset,
  cloneEngineeringAttributesForNewTerminalStripMember,
  formatEngineeringAttributeValue,
  listApplicableEngineeringAttributeDefinitions,
  listApplicableEngineeringAttributeDefinitionsForSubject,
  removeEngineeringAttributeValue,
  resolveEngineeringFacts,
  setEngineeringAttributeValue,
  validateEngineeringAttributeContainer,
  type EngineeringAttributeContainer,
  type EngineeringAttributeValue
} from "../api/public";

const engineerSource = { kind: "engineer_entered" as const };

function quantity(
  definitionKey: string,
  value: number,
  unit: string
): EngineeringAttributeValue {
  return {
    definitionKey,
    definitionVersion: 1,
    kind: "quantity",
    value,
    unit,
    source: engineerSource
  };
}

describe("engineering attribute catalogue", () => {
  it("uses unique stable definition keys", () => {
    const keys = ENGINEERING_ATTRIBUTE_DEFINITIONS.map(
      (definition) => definition.key
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("engineering_purpose");
    expect(keys).toContain("short_circuit_rating_voltage");
  });

  it("filters definitions by managed asset type", () => {
    const cableKeys = listApplicableEngineeringAttributeDefinitions("cable").map(
      (definition) => definition.key
    );
    const relayKeys = listApplicableEngineeringAttributeDefinitions("relay").map(
      (definition) => definition.key
    );
    expect(cableKeys).toContain("conductor_cross_section");
    expect(relayKeys).not.toContain("conductor_cross_section");
    expect(relayKeys).toContain("engineering_purpose");
  });

  it("offers the complete controlled catalogue to terminal-strip members", () => {
    const memberKeys = listApplicableEngineeringAttributeDefinitionsForSubject({
      kind: "structured_terminal_strip_member",
      role: "end_bracket"
    }).map((definition) => definition.key);

    expect(memberKeys).toEqual(
      ENGINEERING_ATTRIBUTE_DEFINITIONS.map((definition) => definition.key)
    );
    expect(
      setEngineeringAttributeValue({
        subject: {
          kind: "structured_terminal_strip_member",
          role: "electrical"
        },
        value: quantity("conductor_cross_section", 2.5, "mm²")
      })
    ).toMatchObject({ ok: true });
  });
});

describe("engineering attribute values", () => {
  it("adds, replaces, and removes one value per definition", () => {
    const added = setEngineeringAttributeValue({
      assetType: "instrument",
      value: quantity("nominal_voltage", 24, "V")
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const replaced = setEngineeringAttributeValue({
      assetType: "instrument",
      container: added.container,
      value: quantity("nominal_voltage", 0.024, "kV")
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.container?.values).toHaveLength(1);
    expect(replaced.container?.values[0]).toMatchObject({
      value: 0.024,
      unit: "kV"
    });

    const removed = removeEngineeringAttributeValue({
      container: replaced.container,
      definitionKey: "nominal_voltage"
    });
    expect(removed).toEqual({ ok: true, container: undefined });
  });

  it("rejects invalid units, ranges, kinds, and applicability", () => {
    expect(
      setEngineeringAttributeValue({
        assetType: "instrument",
        value: quantity("nominal_voltage", 24, "A")
      })
    ).toMatchObject({ ok: false });
    expect(
      setEngineeringAttributeValue({
        assetType: "instrument",
        value: quantity("nominal_voltage", 0, "V")
      })
    ).toMatchObject({ ok: false });
    expect(
      setEngineeringAttributeValue({
        assetType: "relay",
        value: quantity("conductor_cross_section", 1.5, "mm²")
      })
    ).toMatchObject({ ok: false });
    expect(
      setEngineeringAttributeValue({
        assetType: "instrument",
        value: {
          definitionKey: "supply_nature",
          definitionVersion: 1,
          kind: "choice",
          value: "three_phase",
          source: engineerSource
        }
      })
    ).toMatchObject({ ok: false });
  });

  it("rejects duplicate keys in a persisted container", () => {
    const duplicate: EngineeringAttributeContainer = {
      version: 1,
      values: [
        quantity("nominal_voltage", 24, "V"),
        quantity("nominal_voltage", 110, "V")
      ]
    };
    expect(
      validateEngineeringAttributeContainer({
        container: duplicate,
        assetType: "instrument"
      }).ok
    ).toBe(false);
  });

  it("formats stored units and controlled choice labels", () => {
    expect(formatEngineeringAttributeValue(quantity("rated_current", 350, "mA"))).toBe(
      "350 mA"
    );
    expect(
      formatEngineeringAttributeValue({
        definitionKey: "supply_nature",
        definitionVersion: 1,
        kind: "choice",
        value: "dc",
        source: engineerSource
      })
    ).toBe("DC");
  });
});

describe("engineering fact projection", () => {
  it("normalizes valid facts and reports non-blocking consistency diagnostics", () => {
    const projection = resolveEngineeringFacts({
      assetType: "instrument",
      container: {
        version: 1,
        values: [
          quantity("nominal_voltage", 0.024, "kV"),
          {
            definitionKey: "supply_nature",
            definitionVersion: 1,
            kind: "choice",
            value: "dc",
            source: engineerSource
          },
          quantity("frequency", 60, "Hz")
        ]
      }
    });
    expect(projection.facts.find((fact) => fact.definitionKey === "nominal_voltage")).toMatchObject({
      value: 24,
      unit: "V"
    });
    expect(projection.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "inconsistent_values",
        definitionKey: "frequency"
      })
    );
  });

  it("copies valid ratings and clears project purpose without mutating the source", () => {
    const source: EngineeringAttributeContainer = {
      version: 1,
      values: [
        {
          definitionKey: "engineering_purpose",
          definitionVersion: 1,
          kind: "text",
          value: "Tank 1 alarm",
          source: engineerSource
        },
        quantity("nominal_voltage", 24, "V")
      ]
    };
    const clone = cloneEngineeringAttributesForNewAsset({
      container: source,
      assetType: "instrument"
    });
    expect(clone?.values.map((value) => value.definitionKey)).toEqual([
      "nominal_voltage"
    ]);
    expect(clone?.values[0]).not.toBe(source.values[1]);
    expect(source.values).toHaveLength(2);
  });

  it("copies member ratings and clears member purpose", () => {
    const source: EngineeringAttributeContainer = {
      version: 1,
      values: [
        {
          definitionKey: "engineering_purpose",
          definitionVersion: 1,
          kind: "text",
          value: "Tank alarm positive",
          source: engineerSource
        },
        quantity("rated_current", 20, "A")
      ]
    };

    const clone = cloneEngineeringAttributesForNewTerminalStripMember({
      container: source,
      role: "electrical"
    });

    expect(clone?.values.map((value) => value.definitionKey)).toEqual([
      "rated_current"
    ]);
    expect(source.values).toHaveLength(2);
  });
});
