// Explicit server/CLI-only interface; not part of the drawing or browser bundles.
export {
  applySymbolGuidanceRetirement, assertRetirementPath, guidanceRetirementInventorySchema,
  inventorySymbolGuidance, retiredGuidanceTables, verifyGuidanceRecoveryBackup
} from "../data/guidance-retirement";
