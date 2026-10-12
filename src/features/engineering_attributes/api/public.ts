export {
  engineeringAttributeContainerSchema,
  engineeringAttributeDefinitionSchema,
  engineeringAttributeSubjectSchema,
  engineeringAttributeSourceSchema,
  engineeringAttributeValueSchema
} from "../data/schema";
export type {
  EngineeringAttributeCategory,
  EngineeringAttributeContainer,
  EngineeringAttributeDefinition,
  EngineeringAttributeSource,
  EngineeringAttributeSubject,
  EngineeringAttributeValue
} from "../data/schema";
export {
  ENGINEERING_ATTRIBUTE_DEFINITIONS,
  ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY
} from "../data/catalog";
export {
  validateEngineeringAttributeContainer,
  validateEngineeringAttributeValue
} from "../logic/services/engineering-attribute-validation";
export type {
  EngineeringAttributeValidationIssue,
  EngineeringAttributeValidationResult
} from "../logic/services/engineering-attribute-validation";
export { normalizeEngineeringQuantity } from "../logic/services/engineering-quantity-normalization";
export type { EngineeringQuantityNormalizationResult } from "../logic/services/engineering-quantity-normalization";
export {
  cloneEngineeringAttributesForNewAsset,
  cloneEngineeringAttributesForNewTerminalStripMember,
  formatEngineeringAttributeValue,
  listApplicableEngineeringAttributeDefinitions,
  listApplicableEngineeringAttributeDefinitionsForSubject,
  resolveEngineeringFacts
} from "../logic/services/engineering-fact-projection";
export type {
  EngineeringFact,
  EngineeringFactDiagnostic,
  EngineeringFactProjection
} from "../logic/services/engineering-fact-projection";
export {
  removeEngineeringAttributeValue,
  setEngineeringAttributeValue
} from "../logic/use_cases/engineering-attribute-values";
export type { EngineeringAttributeMutationResult } from "../logic/use_cases/engineering-attribute-values";
export { ATTRIBUTE_UNITS, attributeTypeDefinitionSchema, attributeTypeSnapshotSchema, AttributeTypeError } from "../data/type-schema";
export type { AttributeTypeDefinition, AttributeTypeSnapshot, AttributeTypeOption } from "../data/type-schema";
export { ATTRIBUTE_TYPE_SEEDS } from "../data/type-seeds";

export { normalizeEngineeringValue, convertEngineeringUnit, awgToSquareMillimetres } from "../logic/services/normalize-engineering-value";
export type { NormalizedEngineeringValue, NormalizableEngineeringValue } from "../logic/services/normalize-engineering-value";
export { ENGINEERING_UNITS, ENGINEERING_BASE_UNITS } from "../data/unit-catalog";

export { attributeApplicability, rankAttributeTypes } from "../logic/services/attribute-applicability";

export { ATTRIBUTE_TEMPLATES } from "../data/attribute-templates";
export type { AttributeTemplate } from "../data/attribute-templates";
