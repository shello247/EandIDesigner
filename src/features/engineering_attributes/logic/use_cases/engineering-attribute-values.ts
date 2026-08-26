import {
  engineeringAttributeValueSchema,
  type EngineeringAttributeContainer,
  type EngineeringAttributeSubject,
  type EngineeringAttributeValue
} from "../../data/schema";
import { validateEngineeringAttributeValue } from "../services/engineering-attribute-validation";

export type EngineeringAttributeMutationResult =
  | { ok: true; container?: EngineeringAttributeContainer }
  | { ok: false; message: string };

function normalizeSource(value: EngineeringAttributeValue): EngineeringAttributeValue {
  const reference = value.source.reference?.trim() || undefined;
  return {
    ...value,
    source: {
      kind: value.source.kind,
      reference
    }
  } as EngineeringAttributeValue;
}

export function setEngineeringAttributeValue(input: {
  container?: EngineeringAttributeContainer;
  value: EngineeringAttributeValue;
  assetType?: string;
  subject?: EngineeringAttributeSubject;
}): EngineeringAttributeMutationResult {
  const parsed = engineeringAttributeValueSchema.safeParse(input.value);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid attribute value."
    };
  }
  const value = normalizeSource(parsed.data);
  const issues = validateEngineeringAttributeValue({
    value,
    assetType: input.assetType,
    subject: input.subject
  });
  if (issues.length > 0) {
    return { ok: false, message: issues[0].message };
  }

  const current = input.container?.values ?? [];
  const existingIndex = current.findIndex(
    (candidate) => candidate.definitionKey === value.definitionKey
  );
  const values =
    existingIndex < 0
      ? [...current, value]
      : current.map((candidate, index) =>
          index === existingIndex ? value : candidate
        );
  return { ok: true, container: { version: 1, values } };
}

export function removeEngineeringAttributeValue(input: {
  container?: EngineeringAttributeContainer;
  definitionKey: string;
}): EngineeringAttributeMutationResult {
  const values = (input.container?.values ?? []).filter(
    (value) => value.definitionKey !== input.definitionKey
  );
  return values.length > 0
    ? { ok: true, container: { version: 1, values } }
    : { ok: true, container: undefined };
}
