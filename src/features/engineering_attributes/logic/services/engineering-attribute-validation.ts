import {
  engineeringAttributeContainerSchema,
  engineeringAttributeValueSchema,
  type EngineeringAttributeContainer,
  type EngineeringAttributeDefinition,
  type EngineeringAttributeSubject,
  type EngineeringAttributeValue
} from "../../data/schema";
import { ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY } from "../../data/catalog";
import { normalizeEngineeringQuantity } from "./engineering-quantity-normalization";

export type EngineeringAttributeValidationIssue = {
  code:
    | "invalid_container"
    | "unknown_definition"
    | "deprecated_definition"
    | "definition_version"
    | "value_kind"
    | "invalid_value"
    | "invalid_unit"
    | "not_applicable";
  definitionKey?: string;
  message: string;
};

export type EngineeringAttributeValidationResult =
  | { ok: true; container: EngineeringAttributeContainer }
  | { ok: false; issues: EngineeringAttributeValidationIssue[] };

function hasSupportedPrecision(value: number, precision: number | undefined) {
  if (precision === undefined) return true;
  const rounded = Number(value.toFixed(precision));
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 8;
  return Math.abs(value - rounded) <= tolerance;
}

function validateNumericConstraints(
  definition: EngineeringAttributeDefinition,
  value: number
): string | undefined {
  if (!Number.isFinite(value)) return "Enter a finite numeric value.";
  if (
    definition.minimum !== undefined &&
    (definition.minimumExclusive
      ? value <= definition.minimum
      : value < definition.minimum)
  ) {
    return definition.minimumExclusive
      ? `Enter a value greater than ${definition.minimum}.`
      : `Enter a value of at least ${definition.minimum}.`;
  }
  if (definition.maximum !== undefined && value > definition.maximum) {
    return `Enter a value no greater than ${definition.maximum}.`;
  }
  if (!hasSupportedPrecision(value, definition.precision)) {
    return `Use no more than ${definition.precision} decimal places.`;
  }
  return undefined;
}

export function validateEngineeringAttributeValue(input: {
  value: EngineeringAttributeValue;
  assetType?: string;
  subject?: EngineeringAttributeSubject;
}): EngineeringAttributeValidationIssue[] {
  const parsed = engineeringAttributeValueSchema.safeParse(input.value);
  if (!parsed.success) {
    return [
      {
        code: "invalid_value",
        definitionKey: input.value.definitionKey,
        message: parsed.error.issues[0]?.message ?? "Invalid attribute value."
      }
    ];
  }

  const value = parsed.data;
  const definition = ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(
    value.definitionKey
  );
  if (!definition) {
    return [
      {
        code: "unknown_definition",
        definitionKey: value.definitionKey,
        message: `Attribute definition ${value.definitionKey} is unavailable.`
      }
    ];
  }
  if (definition.status === "deprecated") {
    return [
      {
        code: "deprecated_definition",
        definitionKey: value.definitionKey,
        message: `${definition.label} is deprecated.`
      }
    ];
  }
  if (value.definitionVersion !== definition.version) {
    return [
      {
        code: "definition_version",
        definitionKey: value.definitionKey,
        message: `${definition.label} uses an unsupported definition version.`
      }
    ];
  }
  if (value.kind !== definition.valueKind) {
    return [
      {
        code: "value_kind",
        definitionKey: value.definitionKey,
        message: `${definition.label} requires a ${definition.valueKind} value.`
      }
    ];
  }
  const managedAssetType =
    input.subject?.kind === "managed_asset"
      ? input.subject.typeToken
      : input.subject
        ? undefined
        : input.assetType;
  if (
    managedAssetType &&
    definition.applicableAssetTypes &&
    !definition.applicableAssetTypes.includes(managedAssetType)
  ) {
    return [
      {
        code: "not_applicable",
        definitionKey: value.definitionKey,
        message: `${definition.label} is not available for this asset type.`
      }
    ];
  }

  if (value.kind === "text") {
    const maximum = definition.maximumTextLength ?? 400;
    if (!value.value.trim() || value.value.length > maximum) {
      return [
        {
          code: "invalid_value",
          definitionKey: value.definitionKey,
          message: `Enter between 1 and ${maximum} characters.`
        }
      ];
    }
  }

  if (value.kind === "choice") {
    const allowed = definition.choices?.map((choice) => choice.value) ?? [];
    if (!allowed.includes(value.value)) {
      return [
        {
          code: "invalid_value",
          definitionKey: value.definitionKey,
          message: `Choose a supported value for ${definition.label}.`
        }
      ];
    }
  }

  if (value.kind === "number" || value.kind === "quantity") {
    const constraintMessage = validateNumericConstraints(
      definition,
      value.value
    );
    if (constraintMessage) {
      return [
        {
          code: "invalid_value",
          definitionKey: value.definitionKey,
          message: constraintMessage
        }
      ];
    }
  }

  if (value.kind === "quantity") {
    const normalized = normalizeEngineeringQuantity({
      definition,
      value: value.value,
      unit: value.unit
    });
    if (!normalized.ok) {
      return [
        {
          code: "invalid_unit",
          definitionKey: value.definitionKey,
          message: normalized.message
        }
      ];
    }
  }

  return [];
}

export function validateEngineeringAttributeContainer(input: {
  container: EngineeringAttributeContainer;
  assetType?: string;
  subject?: EngineeringAttributeSubject;
}): EngineeringAttributeValidationResult {
  const parsed = engineeringAttributeContainerSchema.safeParse(input.container);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "invalid_container" as const,
        message: issue.message
      }))
    };
  }

  const issues = parsed.data.values.flatMap((value) =>
    validateEngineeringAttributeValue({
      value,
      assetType: input.assetType,
      subject: input.subject
    })
  );
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, container: parsed.data };
}
