export {
  SYMBOL_COMPONENT_MAX_DEPTH,
  drawingComponentSelectionSchema,
  drawingComponentSelectionsSchema,
  symbolComponentBoxSchema,
  symbolComponentDefinitionSchema,
  symbolComponentPositionSchema,
  symbolComponentPositionsSchema
} from "../data/schema";
export type {
  DrawingComponentSelection,
  SymbolComponentBox,
  SymbolComponentDefinition,
  SymbolComponentPosition
} from "../data/schema";
export { mergeImportedComponentConfiguration } from "../logic/use_cases/configure-symbol-components";
export {
  validateComponentDefinitionsBasic,
  validateSymbolComponentDefinitions,
  type ComponentAlternativeCandidate
} from "../logic/services/component-definition-validator";
export {
  collectComponentSelectionVersionIds,
  resolveAutomaticComponentSelections,
  validateDrawingComponentSelections,
  type ComponentSelectableSymbol,
  type ComponentSelectionResolution
} from "../logic/services/component-selection-resolver";
export {
  replaceDrawingAssetComponentSelections,
  validateDrawingAssetComponentConfigurations
} from "../logic/use_cases/configure-drawing-asset-components";
export {
  composeSelectedComponents,
  getComponentCompositionBounds,
  type ComponentBounds,
  type ComponentCompositionPlacement,
  type ComponentCompositionResult,
  type ComponentRootPlacement
} from "../logic/services/component-composition-geometry";
