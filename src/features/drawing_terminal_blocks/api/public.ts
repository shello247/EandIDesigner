export {
  structuredTerminalStripMemberRoleSchema,
  structuredTerminalStripMemberSchema,
  structuredTerminalStripSchema,
  terminalBlockPlacementSchema
} from "../data/schema";
export type {
  StructuredTerminalStrip,
  StructuredTerminalStripMember,
  StructuredTerminalStripMemberRole,
  TerminalBlockPlacement
} from "../data/schema";
export {
  DEFAULT_STRUCTURED_TERMINAL_COUNT,
  allocateStructuredTerminalStripMember,
  applyStructuredTerminalStripMemberOrders,
  cloneStructuredTerminalStrip,
  createDefaultStructuredTerminalStrip,
  deriveStructuredTerminalStripMemberOrders,
  insertStructuredTerminalStripMember,
  removeStructuredTerminalStripMember,
  reorderStructuredTerminalStripMember
} from "../logic/services/structured-terminal-strip";
export {
  composeTerminalStripGeometry,
  type TerminalStripCompositionGeometry,
  type TerminalStripMemberGeometry
} from "../logic/services/terminal-strip-composition-geometry";
export {
  namespaceStructuredTerminalKey,
  projectStructuredTerminalStripTerminals,
  type StructuredTerminalStripTerminalProjection
} from "../logic/services/terminal-strip-terminal-projection";
export {
  cloneStructuredTerminalStripMemberAttributes,
  countStructuredTerminalStripMemberAttributes,
  projectStructuredTerminalStripMemberFacts,
  resolveStructuredTerminalStripMemberFacts,
  resolveStructuredTerminalStripMemberForKey,
  resolveStructuredTerminalStripMemberPurpose,
  retainStructuredTerminalStripMemberPurpose,
  structuredTerminalStripMemberAttributeSubject,
  type StructuredTerminalStripMemberFactProjection
} from "../logic/services/terminal-strip-member-attributes";
export {
  listEligibleTerminalStripSymbols,
  resolveTerminalStripDefaults,
  validateStructuredTerminalStripMembers,
  validateTerminalStripMemberSymbol,
  type TerminalStripMemberSymbol
} from "../logic/services/terminal-strip-validation";
export { renderStructuredTerminalStripSvg } from "../logic/services/terminal-strip-renderer";
