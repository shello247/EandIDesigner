import type {
  PanelBondRecord,
  PanelBridgeRecord,
  PanelInternalWireRecord,
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

export type {
  PanelBondEndpoint,
  PanelBondRecord,
  PanelBridgeRecord,
  PanelDrawingContext,
  PanelElectricalDomain,
  PanelInternalWireRecord,
  PanelRecordOrigin,
  PanelSourceEndpointRef,
  PanelTerminalMapping,
  PanelTerminalRef,
  PanelTerminalSide,
  PanelTerminalSideRef,
  PanelWireAttributes,
  PanelWiringMutation,
  PanelWiringPackageData,
  PanelWiringSourceAsset,
  PanelWiringSourceConnection,
  PanelWiringSourceOccurrence,
  PanelWiringSourcePackage,
  PanelWiringSourceSheet,
  PanelWiringSourceTerminal
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
  supportedSides: PanelTerminalSide[];
  anchors: PanelWiringSourceTerminal["anchors"];
  occurrenceRefs: PanelTerminalOccurrenceRef[];
};

export type PanelTerminalSideNode = {
  id: string;
  ref: PanelTerminalSideRef;
  terminalId: string;
};

export type PanelExternalTermination = {
  id: string;
  panelAssetId: string;
  status: "resolved" | "unresolved";
  target?: PanelTerminalSideRef;
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

export type PanelAssociatedAssetCatalogRow = {
  assetId: string;
  tag: string;
  title: string;
  type: PanelWiringSourceAsset["type"];
  status: PanelDiscoveryStatus;
  terminalCount: number;
  representedPlacementId?: string;
  sourceOccurrences: PanelSourceOccurrenceRef[];
  disabledReason?: string;
};

export type ExternalTerminationCatalogRow = {
  terminationId: string;
  panelAssetId: string;
  status: PanelDiscoveryStatus;
  target?: PanelTerminalSideRef;
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
  findings: PanelConnectivityFinding[];
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
  findings: PanelConnectivityFinding[];
};

export type PanelWiringCommandResult = {
  mutations: PanelWiringMutation[];
  warnings: PanelConnectivityFinding[];
  affectedIds: string[];
};
