import type {
  PanelBondRecord,
  PanelBridgeRecord,
  PanelConnectionDisplayMode,
  PanelDrawingQualityFinding,
  PanelElectricalDomain,
  PanelFindingLocation,
  PanelInternalWireRecord,
  PanelPatternSettings,
  PanelPatternTopology,
  PanelSourceEndpointRef,
  PanelTerminalRef,
  PanelTerminalSide,
  PanelTerminalSideRef,
  PanelWiringMutation,
  PanelWiringSourceAsset,
  PanelWiringSourceConnection,
  PanelWiringSourceOccurrence,
  PanelWiringSourcePackage,
  PanelWiringSourceSheet,
  PanelWiringSourceTerminal
} from "../data/schema";
import type {
  SymbolMetadata,
  SymbolPanelWiringAssetType
} from "@/features/symbol_registry/api/public";

export type {
  PanelBondEndpoint,
  PanelBondRecord,
  PanelBridgeRecord,
  PanelDrawingFindingCategory,
  PanelDrawingFindingSeverity,
  PanelDrawingContext,
  PanelDrawingQualityCounts,
  PanelDrawingQualityFinding,
  PanelDrawingQualityReport,
  PanelElectricalDomain,
  PanelFindingLocation,
  PanelFindingObjectKind,
  PanelFindingRepairKind,
  PanelFindingRepairProposal,
  PanelInternalWireRecord,
  PanelPatternCounters,
  PanelPatternDefinition,
  PanelPatternSettings,
  PanelPatternTopology,
  PanelRecordOrigin,
  PanelSourceEndpointRef,
  PanelTerminalMapping,
  PanelTerminalRef,
  PanelTerminalSide,
  PanelTerminalSideRef,
  PanelWireAttributes,
  PanelWireIdPolicy,
  PanelWireNumberSettings,
  PanelWireSettings,
  PanelWiringMutation,
  PanelWiringPackageData,
  PanelWiringSourceAsset,
  PanelWiringSourceConnection,
  PanelWiringSourceElectricalTopology,
  PanelWiringSourceOccurrence,
  PanelWiringSourcePackage,
  PanelWiringSourceSheet,
  PanelWiringSourceTerminal,
  PackagePanelDrawingQualityReport
} from "../data/schema";

export type PanelConnectivityFindingSeverity = "error" | "warning" | "info";

export type PanelConnectivityFinding = {
  id: string;
  severity: PanelConnectivityFindingSeverity;
  code: string;
  message: string;
  panelAssetId?: string;
  assetId?: string;
  terminal?: PanelTerminalSideRef;
  source?: PanelSourceEndpointRef;
};

export type PanelTerminalOccurrenceRef = {
  sheetId: string;
  placementId: string;
};

export type PanelTerminalNode = {
  id: string;
  ref: PanelTerminalRef;
  label: string;
  function?: string;
  allowedDomains?: PanelElectricalDomain[];
  requiredSides?: PanelTerminalSide[];
  supportedSides: PanelTerminalSide[];
  anchors: PanelWiringSourceTerminal["anchors"];
  occurrenceRefs: PanelTerminalOccurrenceRef[];
};

export type PanelTerminalSideNode = {
  id: string;
  ref: PanelTerminalSideRef;
  terminalId: string;
};

export type PanelElectricalNode =
  | {
      id: string;
      kind: "terminal_side";
      terminal: PanelTerminalSideRef;
    }
  | {
      id: string;
      kind: "panel_reference";
      panelAssetId: string;
      referenceKind: "shield" | "protective_earth" | "signal_ground";
      key?: string;
    };

export type PanelConductiveRelationshipKind =
  | "terminal_body"
  | "registry_continuity"
  | "drawing_connection"
  | "internal_wire"
  | "bridge"
  | "bond";

export type PanelConductiveRelationshipProvenance = {
  label: string;
  assetId?: string;
  panelAssetId?: string;
  sheetId?: string;
  sheetNumber?: number;
  sheetName?: string;
  connectionId?: string;
  wireId?: string;
  cableTag?: string;
  conductorKey?: string;
  symbolId?: string;
  versionId?: string;
  continuityGroupKey?: string;
  continuityGroupLabel?: string;
  recordId?: string;
};

export type PanelConductiveRelationship = {
  id: string;
  kind: PanelConductiveRelationshipKind;
  nodeIds: string[];
  provenance: PanelConductiveRelationshipProvenance;
};

export type PanelElectricalNet = {
  id: string;
  nodeIds: string[];
  relationshipIds: string[];
  terminalSideIds: string[];
  assetIds: string[];
  panelAssetIds: string[];
};

export type PanelElectricalPathStep = {
  fromNodeId: string;
  toNodeId: string;
  relationship: PanelConductiveRelationship;
};

export type PanelElectricalPath = {
  netId: string;
  fromNodeId: string;
  toNodeId: string;
  steps: PanelElectricalPathStep[];
};

export type PanelExternalTermination = {
  id: string;
  panelAssetId: string;
  status: "resolved" | "unresolved";
  mappingMode: "automatic" | "manual" | "unmapped";
  mappingId?: string;
  inferredTarget?: PanelTerminalSideRef;
  target?: PanelTerminalSideRef;
  sourceAssetId?: string;
  sourceAssetTag?: string;
  source: PanelSourceEndpointRef;
  sourceSheet: {
    id: string;
    number: number;
    name: string;
  };
  wireId?: string;
  cableAssetId?: string;
  cablePlacementId?: string;
  cableTag?: string;
  conductorKey?: string;
  unresolvedCode?: "unresolved_anchor" | "missing_terminal_side";
  unresolvedReason?: string;
};

export type PanelExternalTerminationProvenance = PanelExternalTermination;

export type PanelExternalTerminationDisplayRow = {
  terminationId: string;
  panelAssetId: string;
  detailedSheetId: string;
  placementId: string;
  anchorKey: string;
  physicalPosition?: PanelWirePhysicalPosition;
  target: PanelTerminalSideRef;
  wireId?: string;
  cableTag?: string;
  conductorKey?: string;
  source: PanelSourceEndpointRef;
  sourceSheet: {
    id: string;
    number: number;
    name: string;
  };
};

export type PlacementWireContextRequest = {
  sheetId: string;
  placementId: string;
  mode: PanelConnectionDisplayMode;
};

export type PlacementWireContextDisplayRow = {
  placementId: string;
  anchorKey: string;
  physicalPosition?: PanelWirePhysicalPosition;
  canonicalKind: "field_connection" | "internal_wire";
  canonicalId: string;
  fieldConnectionId?: string;
  direction: "incoming" | "outgoing";
  wireId: string;
  externalTerminationId?: string;
  cableTag?: string;
  conductorKey?: string;
  oppositeEndpoint: {
    assetTag: string;
    terminalKey: string;
  };
  sourceSheet?: {
    id: string;
    number: number;
    name: string;
  };
};

export type PlacementWireContextSummary = {
  placementId: string;
  visibleCount: number;
  internalVisibleCount: number;
  externalVisibleCount: number;
  unresolvedCount: number;
};

export type PlacementWireContextDisplayIndex = {
  rowsBySheetId: ReadonlyMap<string, PlacementWireContextDisplayRow[]>;
  summariesBySheetPlacement: ReadonlyMap<
    string,
    PlacementWireContextSummary
  >;
};

export type PanelDiscoveryStatus =
  | "available"
  | "represented"
  | "missing"
  | "conflicting"
  | "unsupported";

export type PanelSourceOccurrenceRef = {
  sheetId: string;
  sheetName: string;
  sheetNumber: number;
  placementId: string;
  occurrenceKind: PanelWiringSourceOccurrence["occurrenceKind"];
  role: PanelWiringSourceOccurrence["role"];
  symbolId: string;
  versionId: string;
};

export type PanelEquipmentSequence = {
  position: number;
  row: number;
  column: number;
  sourceSheetId: string;
  backplanePlacementId: string;
};

export type PanelEquipmentSequenceIndex = {
  sequenceByAssetId: ReadonlyMap<string, PanelEquipmentSequence>;
  duplicateLayoutAssetIds: ReadonlySet<string>;
};

export type PanelAssociatedAssetCatalogRow = {
  assetId: string;
  tag: string;
  title: string;
  type: PanelWiringSourceAsset["type"];
  status: PanelDiscoveryStatus;
  terminalCount: number;
  terminalUsage: {
    used: number;
    unused: number;
    total: number;
  };
  representedPlacementId?: string;
  representationSource?: PanelSourceOccurrenceRef;
  sourceOccurrences: PanelSourceOccurrenceRef[];
  panelSequence?: PanelEquipmentSequence;
  panelSequenceWarning?: string;
  disabledReason?: string;
};

export type ExternalTerminationCatalogRow = {
  terminationId: string;
  panelAssetId: string;
  status: PanelDiscoveryStatus;
  mappingMode: ExternalTerminationMappingMode;
  mappingId?: string;
  inferredTarget?: PanelTerminalSideRef;
  target?: PanelTerminalSideRef;
  sourceAssetId?: string;
  sourceAssetTag?: string;
  targetAssetId?: string;
  targetAssetTag?: string;
  representedPlacementId?: string;
  wireId?: string;
  cableAssetId?: string;
  cablePlacementId?: string;
  cableTag?: string;
  conductorKey?: string;
  source: PanelSourceEndpointRef;
  sourceSheet: { id: string; number: number; name: string };
  disabledReason?: string;
};

export type PanelQualityRouteRef = {
  sheetId: string;
  sheetNumber: number;
  sheetName: string;
  connection: PanelWiringSourceConnection;
};

export type PanelQualityIndex = {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  panelTag: string;
  associatedAssetIds: ReadonlySet<string>;
  detailedSheets: PanelWiringSourceSheet[];
  terminalCatalog: PanelTerminalCatalog;
  internalWireRoutesByRecordId: ReadonlyMap<string, PanelQualityRouteRef[]>;
  patternRoutesByRecordId: ReadonlyMap<string, PanelQualityRouteRef[]>;
};

export type GroupedPanelDrawingFindings = {
  severity: PanelDrawingQualityFinding["severity"];
  count: number;
  findings: PanelDrawingQualityFinding[];
};

export type PanelFindingNavigationTarget =
  | { kind: "sheet_object"; location: PanelFindingLocation }
  | {
      kind: "work_queue";
      panelAssetId: string;
      tab: "terminations" | "terminal-map" | "internal-wires" | "patterns";
      objectId?: string;
    }
  | { kind: "panel_context"; location: PanelFindingLocation };

export type PanelApprovedRepairResult = {
  modelChanged: boolean;
  resolvedFindingId: string;
  affectedIds: string[];
  warnings: string[];
};


export type ExternalTerminationMappingMode =
  | "automatic"
  | "manual"
  | "unmapped"
  | "conflicting";

export type PanelTerminalOccupantKind =
  | "external_termination"
  | "internal_wire"
  | "bridge"
  | "bond";

export type PanelTerminalOccupant = {
  id: string;
  kind: PanelTerminalOccupantKind;
  label: string;
  channel?: "conductor" | "structural";
  ownerPatternId?: string;
  wireNumber?: number;
  wireId?: string;
  cableTag?: string;
  conductorKey?: string;
  sourceSheet?: { id: string; number: number; name: string };
};

export type PanelTerminalSideOccupancy = {
  ref: PanelTerminalSideRef;
  status: "available" | "occupied" | "conflicting";
  occupants: PanelTerminalOccupant[];
  conductorStatus: "available" | "occupied" | "conflicting";
  conductorOccupants: PanelTerminalOccupant[];
  structuralStatus: "available" | "occupied" | "conflicting";
  structuralOccupants: PanelTerminalOccupant[];
};

export type PanelTerminalCatalogRow = {
  terminalId: string;
  terminal: PanelTerminalRef;
  assetTag: string;
  assetTitle: string;
  assetType: PanelWiringSourceAsset["type"];
  label: string;
  function?: string;
  supportedSides: PanelTerminalSide[];
  requiredSides?: PanelTerminalSide[];
  allowedDomains?: PanelElectricalDomain[];
  occupancy: Partial<Record<PanelTerminalSide, PanelTerminalSideOccupancy>>;
  findings: PanelConnectivityFinding[];
};

export type PanelTerminalCatalog = {
  panelAssetId: string;
  rowsByTerminalId: ReadonlyMap<string, PanelTerminalCatalogRow>;
  occupancyBySideId: ReadonlyMap<string, PanelTerminalSideOccupancy>;
  findings: PanelConnectivityFinding[];
};

export type ExternalTerminationMappingRow = ExternalTerminationCatalogRow & {
  effectiveTarget?: PanelTerminalSideRef;
  mappingDisabledReason?: string;
  findings: PanelConnectivityFinding[];
};

export type PanelTerminalMappingCandidate = {
  ref: PanelTerminalSideRef;
  assetTag: string;
  assetTitle: string;
  terminalLabel: string;
  function?: string;
  occupancy: PanelTerminalSideOccupancy;
  disabledReason?: string;
};

export type PanelDiscoveryBuildContext = {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  detailedSheetId: string;
  representedPlacementIdsByAssetId: ReadonlyMap<string, string>;
};

export type PanelDiscoveryIndex = {
  panelAssetId: string;
  detailedSheetId: string;
  assetsById: ReadonlyMap<string, PanelAssociatedAssetCatalogRow>;
  terminationsById: ReadonlyMap<string, ExternalTerminationCatalogRow>;
  terminalCatalog: PanelTerminalCatalog;
  mappingRowsByTerminationId: ReadonlyMap<
    string,
    ExternalTerminationMappingRow
  >;
  representedPlacementIdByAssetId: ReadonlyMap<string, string>;
  warnings: PanelConnectivityFinding[];
};

export type PanelDiscoverySnapshot = {
  panelAssetId: string;
  detailedSheetId: string;
  assets: PanelAssociatedAssetCatalogRow[];
  terminations: ExternalTerminationCatalogRow[];
  warnings: PanelConnectivityFinding[];
};

export type PanelComponentSymbol = {
  symbolId: string;
  versionId: string;
  symbolKey: string;
  displayName: string;
  metadata: SymbolMetadata;
};

export type PanelComponentTerminalSummary = {
  terminalKey: string;
  label: string;
  function?: string;
  supportedSides: PanelTerminalSide[];
  anchors: Array<{ anchorKey: string; side?: PanelTerminalSide }>;
};

export type PanelComponentPaletteGroup =
  | "circuit_protection"
  | "relays"
  | "power"
  | "control_io"
  | "networking"
  | "isolation_conversion"
  | "terminal_blocks"
  | "earth_ground"
  | "instruments"
  | "other";

export type PanelComponentPaletteRow = {
  symbolId: string;
  versionId: string;
  symbolKey: string;
  displayName: string;
  assetType: SymbolPanelWiringAssetType;
  tagPrefix: string;
  schematicScale?: number;
  group: PanelComponentPaletteGroup;
  status: "ready" | "blocked";
  terminals: PanelComponentTerminalSummary[];
  warnings: string[];
  blockingReasons: string[];
};

export type CompatiblePanelComponentAssetOption = {
  assetId: string;
  tag: string;
  title: string;
  type: PanelWiringSourceAsset["type"];
  symbolId: string;
  versionId: string;
  sourceSheets: Array<{ id: string; number: number; name: string }>;
};

export type PanelComponentPlacementSummary = {
  assetId?: string;
  tag: string;
  title?: string;
  assetType?: PanelWiringSourceAsset["type"];
  symbolId: string;
  versionId: string;
  panelAssetId?: string;
  terminals: PanelComponentTerminalSummary[];
  warnings: string[];
  blockingReasons: string[];
};

export type PanelInternalWireCatalogRow = {
  wire: PanelInternalWireRecord;
  fromLabel: string;
  toLabel: string;
  routeSheets: Array<{ id: string; number: number; name: string }>;
  routeOccurrences: Array<{
    sheetId: string;
    sheetNumber: number;
    sheetName: string;
    connectionId: string;
  }>;
  represented: boolean;
  findings: PanelConnectivityFinding[];
};

export type PanelWireEndpointValidation = {
  valid: boolean;
  findings: PanelConnectivityFinding[];
};

export type PanelWirePhysicalPosition = "top" | "right" | "bottom" | "left";

export type PanelInternalWireEndpointOption = {
  id: string;
  terminal: PanelTerminalSideRef;
  placementId: string;
  anchorKey: string;
  assetTag: string;
  assetTitle: string;
  terminalLabel: string;
  terminalFunction?: string;
  physicalPosition?: PanelWirePhysicalPosition;
  disabledReason?: string;
};

export type PanelInternalWireEquipmentOption = {
  assetId: string;
  tag: string;
  title: string;
  placementId: string;
  endpoints: PanelInternalWireEndpointOption[];
  disabledReason?: string;
};

export type PanelInternalWireEndpointCatalog = {
  panelAssetId: string;
  sheetId: string;
  equipment: PanelInternalWireEquipmentOption[];
};

export type PanelInternalWireEndpointPairState = {
  enabled: boolean;
  disabledReason?: string;
};

export type PanelConnectionPatternRecord =
  | { recordType: "bridge"; record: PanelBridgeRecord }
  | { recordType: "bond"; record: PanelBondRecord };

export type PanelPatternRouteOccurrence = {
  sheetId: string;
  sheetNumber: number;
  sheetName: string;
  connectionId: string;
  segmentId?: string;
};

export type PanelConnectionPatternCatalogRow = PanelConnectionPatternRecord & {
  patternId: string;
  patternCode: string;
  topology:
    | PanelPatternTopology
    | "shield"
    | "protective_earth"
    | "signal_ground"
    | "legacy";
  displayLabel: string;
  domain: PanelElectricalDomain;
  memberLabels: string[];
  ownedWireIds: string[];
  routeOccurrences: PanelPatternRouteOccurrence[];
  represented: boolean;
  findings: PanelConnectivityFinding[];
};

export type PanelPatternCommandResult = PanelWiringCommandResult & {
  pattern?: PanelConnectionPatternRecord;
  wires?: PanelInternalWireRecord[];
  settings?: PanelPatternSettings;
};

export type PanelConnectivityGraph = {
  source: PanelWiringSourcePackage;
  assetsById: ReadonlyMap<string, PanelWiringSourceAsset>;
  sheetsById: ReadonlyMap<string, PanelWiringSourceSheet>;
  occurrencesByAssetId: ReadonlyMap<string, PanelWiringSourceOccurrence[]>;
  occurrencesBySheetPlacement: ReadonlyMap<string, PanelWiringSourceOccurrence>;
  connectionsBySheetConnection: ReadonlyMap<
    string,
    PanelWiringSourceConnection
  >;
  panelAssetIds: ReadonlySet<string>;
  assetIdsByPanelAssetId: ReadonlyMap<string, ReadonlySet<string>>;
  panelAssetIdsByAssetId: ReadonlyMap<string, ReadonlySet<string>>;
  terminalsById: ReadonlyMap<string, PanelTerminalNode>;
  terminalSidesById: ReadonlyMap<string, PanelTerminalSideNode>;
  externalTerminationsById: ReadonlyMap<string, PanelExternalTermination>;
  externalTerminationIdsByPanelAssetId: ReadonlyMap<string, string[]>;
  internalWiresById: ReadonlyMap<string, PanelInternalWireRecord>;
  bridgesById: ReadonlyMap<string, PanelBridgeRecord>;
  bondsById: ReadonlyMap<string, PanelBondRecord>;
  electricalNodesById: ReadonlyMap<string, PanelElectricalNode>;
  conductiveRelationshipsById: ReadonlyMap<
    string,
    PanelConductiveRelationship
  >;
  relationshipIdsByElectricalNodeId: ReadonlyMap<string, string[]>;
  electricalNetsById: ReadonlyMap<string, PanelElectricalNet>;
  electricalNetIdByNodeId: ReadonlyMap<string, string>;
  findings: PanelConnectivityFinding[];
};

export type PanelEngineeringSnapshot = {
  revision: string;
  source: PanelWiringSourcePackage;
  graph: PanelConnectivityGraph;
  panelAssetIds: string[];
};

export type PanelConnectivitySnapshot = {
  panelAssetId?: string;
  assets: PanelWiringSourceAsset[];
  occurrences: PanelWiringSourceOccurrence[];
  terminals: PanelTerminalNode[];
  terminalSides: PanelTerminalSideNode[];
  externalTerminations: PanelExternalTermination[];
  internalWires: PanelInternalWireRecord[];
  bridges: PanelBridgeRecord[];
  bonds: PanelBondRecord[];
  electricalNets: PanelElectricalNet[];
  conductiveRelationships: PanelConductiveRelationship[];
  findings: PanelConnectivityFinding[];
};

export type PanelWiringCommandResult = {
  mutations: PanelWiringMutation[];
  warnings: PanelConnectivityFinding[];
  affectedIds: string[];
};
