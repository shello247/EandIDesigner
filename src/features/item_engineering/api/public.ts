export {
  saveItemEngineerNoteInputSchema, archiveItemEngineerNoteInputSchema, reorderItemEngineerNoteInputSchema,
  itemEngineerNoteMetadataSchema, itemEngineerNoteDetailSchema, itemEngineerNotePageInputSchema,
  ITEM_NOTE_MAX_IMAGE_BYTES,
  saveItemEngineeringRevisionInputSchema,
  itemEngineeringDeviceTypeSchema,
  itemEngineeringRevisionSchema,
  itemShortCircuitRatingSchema,
  symbolItemConfigurationSchema,
  itemEngineeringProfileSchema,
  itemSelectionSchema,
  itemSpecificationContextSchema,
  itemSpecificationGroupSchema,
  terminalConductorRangeSchema
} from "../data/schema";
export type {
  SaveItemEngineerNoteInput, ItemEngineerNoteMetadata,
  ItemEngineeringRevision,
  SaveItemEngineeringRevisionInput,
  ItemEngineeringProfile,
  ItemSelection,
  ItemSpecificationContext,
  TerminalConductorRange
} from "../data/schema";
export { resolveItemEngineeringProfile } from "../logic/services/item-engineering-profile";
export type { ItemEngineeringProfileResolution } from "../logic/services/item-engineering-profile";
export type { ItemEngineeringActionResult } from "../types";
export { itemProfileV2Schema, itemAttributeEntrySchema, attributePayloadSchema } from "../data/attribute-schema";
export type { ItemProfileV2, ItemAttributeEntry, AttributePayload } from "../data/attribute-schema";
export { projectItemAttributeProfile, itemAttributeDisplay } from "../logic/services/item-attribute-profile";
export { ITEM_DEVICE_TYPE_OPTIONS, getItemDeviceTypeLabel } from "../logic/services/item-device-types";
export type { ItemDeviceType } from "../logic/services/item-device-types";

export { itemProfileV3Schema, specificationEntrySchema, attributeEvidenceSchema } from "../data/profile-v3-schema";
export type { ItemProfileV3, SpecificationEntry, AttributeEvidence, ProductChannel, ProductTerminal } from "../data/profile-v3-schema";
export { projectItemProfileV3 } from "../logic/services/profile-v3-adapter";
export { productConfigurationSchema, productInterfaceSchema, drawingProductSelectionSchema, engineeringProjectSettingsSchema, physicalProductTargetSchema } from "../data/product-selection-schema";
export type { ProductConfiguration, CompatibleProduct, ProductInterface, AdditionalProductPart, DrawingProductSelection, EngineeringProjectSettings, PhysicalProductTarget } from "../data/product-selection-schema";
export { symbolProductContract, validateProductCompatibility } from "../logic/services/item-interface";
export {compareProductRevisions} from "../logic/services/compare-product-revisions";
export {resolveEffectiveEngineeringFacts,findEngineeringFact,engineeringFactKey,systemAttributeMeaning,validateProjectEngineeringSettings} from "../logic/services/effective-engineering-facts";
export type {EffectiveEngineeringFacts,EngineeringFact} from "../logic/services/effective-engineering-facts";
