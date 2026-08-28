import {
  ENGINEERING_ATTRIBUTE_DEFINITIONS,
  ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY
} from "../../data/catalog";
import type {
  EngineeringAttributeContainer,
  EngineeringAttributeDefinition,
  EngineeringAttributeSource,
  EngineeringAttributeSubject,
  EngineeringAttributeValue
} from "../../data/schema";
import { validateEngineeringAttributeValue } from "./engineering-attribute-validation";
import { normalizeEngineeringQuantity } from "./engineering-quantity-normalization";

export type EngineeringFact = {
  definitionKey: string;
  definitionVersion: 1;
  kind: EngineeringAttributeValue["kind"];
  value: string | number;
  unit?: string;
  source: EngineeringAttributeSource;
};

export type EngineeringFactDiagnostic = {
  code: "invalid_value" | "inconsistent_values";
  definitionKey?: string;
  message: string;
};

export type EngineeringFactProjection = {
  facts: EngineeringFact[];
  diagnostics: EngineeringFactDiagnostic[];
};

export function listApplicableEngineeringAttributeDefinitions(assetType: string) {
  return ENGINEERING_ATTRIBUTE_DEFINITIONS.filter(
    (definition) =>
      definition.status === "active" &&
      (!definition.applicableAssetTypes ||
        definition.applicableAssetTypes.includes(assetType))
  );
}

export function listApplicableEngineeringAttributeDefinitionsForSubject(
  subject: EngineeringAttributeSubject
) {
  if (subject.kind === "structured_terminal_strip_member") {
    return ENGINEERING_ATTRIBUTE_DEFINITIONS.filter(
      (definition) => definition.status === "active"
    );
  }
  return listApplicableEngineeringAttributeDefinitions(subject.typeToken);
}

function factForValue(
  value: EngineeringAttributeValue,
  definition: EngineeringAttributeDefinition
): EngineeringFact | undefined {
  if (value.kind === "quantity") {
    const normalized = normalizeEngineeringQuantity({
      definition,
      value: value.value,
      unit: value.unit
    });
    return normalized.ok
      ? {
          definitionKey: value.definitionKey,
          definitionVersion: 1,
          kind: value.kind,
          value: normalized.value,
          unit: normalized.unit,
          source: value.source
        }
      : undefined;
  }
  return {
    definitionKey: value.definitionKey,
    definitionVersion: 1,
    kind: value.kind,
    value: value.value,
    source: value.source
  };
}

export function resolveEngineeringFacts(input: {
  container?: EngineeringAttributeContainer;
  assetType?: string;
  subject?: EngineeringAttributeSubject;
}): EngineeringFactProjection {
  const facts: EngineeringFact[] = [];
  const diagnostics: EngineeringFactDiagnostic[] = [];
  for (const value of input.container?.values ?? []) {
    const definition = ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(
      value.definitionKey
    );
    const issues = validateEngineeringAttributeValue({
      value,
      assetType: input.assetType,
      subject: input.subject
    });
    if (!definition || issues.length > 0) {
      diagnostics.push(
        ...issues.map((issue) => ({
          code: "invalid_value" as const,
          definitionKey: value.definitionKey,
          message: issue.message
        }))
      );
      continue;
    }
    const fact = factForValue(value, definition);
    if (fact) facts.push(fact);
  }

  const factByKey = new Map(facts.map((fact) => [fact.definitionKey, fact]));
  const supplyNature = factByKey.get("supply_nature")?.value;
  const phase = factByKey.get("phase_configuration")?.value;
  if (supplyNature === "dc" && phase && phase !== "not_applicable") {
    diagnostics.push({
      code: "inconsistent_values",
      definitionKey: "phase_configuration",
      message: "Phase configuration should be Not applicable for a DC supply."
    });
  }
  for (const key of ["frequency", "apparent_power_consumption", "power_factor"])
    if (supplyNature === "dc" && factByKey.has(key)) {
      diagnostics.push({
        code: "inconsistent_values",
        definitionKey: key,
        message: `${ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(key)?.label} is normally applicable only to AC supplies.`
      });
    }
  const hasSccr = factByKey.has("short_circuit_current_rating");
  const hasSccrVoltage = factByKey.has("short_circuit_rating_voltage");
  if (hasSccr !== hasSccrVoltage) {
    diagnostics.push({
      code: "inconsistent_values",
      definitionKey: hasSccr
        ? "short_circuit_rating_voltage"
        : "short_circuit_current_rating",
      message: "Record both the SCCR current and the voltage at which it applies."
    });
  }

  return { facts, diagnostics };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6
  }).format(value);
}

export function formatEngineeringAttributeValue(
  value: EngineeringAttributeValue
): string {
  const definition = ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(
    value.definitionKey
  );
  if (value.kind === "choice") {
    return (
      definition?.choices?.find((choice) => choice.value === value.value)
        ?.label ?? value.value
    );
  }
  if (value.kind === "quantity") {
    return `${formatNumber(value.value)} ${value.unit}`;
  }
  if (value.kind === "number") return formatNumber(value.value);
  return value.value;
}

export function cloneEngineeringAttributesForNewAsset(input: {
  container?: EngineeringAttributeContainer;
  assetType: string;
}): EngineeringAttributeContainer | undefined {
  const values = (input.container?.values ?? []).flatMap((value) => {
    const definition = ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(
      value.definitionKey
    );
    if (
      !definition ||
      definition.copyPolicy !== "copy" ||
      validateEngineeringAttributeValue({ value, assetType: input.assetType })
        .length > 0
    ) {
      return [];
    }
    return [
      {
        ...value,
        source: { ...value.source }
      } as EngineeringAttributeValue
    ];
  });
  return values.length > 0 ? { version: 1, values } : undefined;
}


export function cloneEngineeringAttributesForNewTerminalStripMember(input: {
  container?: EngineeringAttributeContainer;
  role: "electrical" | "end_bracket" | "accessory";
}): EngineeringAttributeContainer | undefined {
  const subject: EngineeringAttributeSubject = {
    kind: "structured_terminal_strip_member",
    role: input.role
  };
  const values = (input.container?.values ?? []).flatMap((value) => {
    const definition = ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(
      value.definitionKey
    );
    if (
      !definition ||
      definition.copyPolicy !== "copy" ||
      validateEngineeringAttributeValue({ value, subject }).length > 0
    ) {
      return [];
    }
    return [
      {
        ...value,
        source: { ...value.source }
      } as EngineeringAttributeValue
    ];
  });
  return values.length > 0 ? { version: 1, values } : undefined;
}
