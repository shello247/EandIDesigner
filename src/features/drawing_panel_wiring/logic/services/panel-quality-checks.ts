import {
  packagePanelDrawingQualityReportSchema,
  panelDrawingQualityFindingSchema,
  panelDrawingQualityReportSchema,
  type PackagePanelDrawingQualityReport,
  type PanelDrawingFindingCategory,
  type PanelDrawingFindingSeverity,
  type PanelDrawingQualityFinding,
  type PanelDrawingQualityReport,
  type PanelFindingLocation,
  type PanelFindingRepairProposal,
  type PanelTerminalSideRef
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelQualityIndex,
  PanelQualityRouteRef
} from "../../types";
import {
  buildPanelQualityIndex,
  buildPanelQualitySharedIndex
} from "./panel-quality-index";
import { terminalSideNodeId } from "./terminal-resolution";

const BLOCKING_GRAPH_CODES = new Set([
  "missing_symbol",
  "missing_metadata",
  "ambiguous",
  "linked_terminal_configuration_mismatch",
  "asset_associated_with_multiple_panels"
]);

const WARNING_GRAPH_CODES = new Set([
  "terminal_domain_unverified",
  "terminal_capacity_unverified",
  "cross_domain_shield_bond",
  "legacy_pattern_definition",
  "legacy_bond_definition"
]);

const DEDICATED_QUALITY_CODES = new Set([
  "duplicate_internal_wire_id",
  "unresolved_external_termination"
]);

function normalized(value: string): string {
  return value.trim().toUpperCase();
}

function findingId(code: string, ...parts: Array<string | undefined>): string {
  return ["panel_qc", code, ...parts.filter(Boolean).map(String)].join(":");
}

function locationForSheet(
  index: PanelQualityIndex,
  sheetId: string,
  objectKind: PanelFindingLocation["objectKind"],
  objectId?: string
): PanelFindingLocation | undefined {
  const sheet = index.graph.sheetsById.get(sheetId);
  return sheet
    ? {
        sheetId: sheet.id,
        sheetNumber: sheet.sheetNumber,
        sheetName: sheet.name,
        objectKind,
        objectId
      }
    : undefined;
}

function firstDetailedLocation(
  index: PanelQualityIndex,
  objectKind: PanelFindingLocation["objectKind"],
  objectId?: string
): PanelFindingLocation[] {
  const sheet = index.detailedSheets[0];
  return sheet
    ? [
        {
          sheetId: sheet.id,
          sheetNumber: sheet.sheetNumber,
          sheetName: sheet.name,
          objectKind,
          objectId
        }
      ]
    : [];
}

function locationsForAsset(
  index: PanelQualityIndex,
  assetId: string
): PanelFindingLocation[] {
  return (index.graph.occurrencesByAssetId.get(assetId) ?? [])
    .map((occurrence) =>
      locationForSheet(
        index,
        occurrence.sheetId,
        "placement",
        occurrence.placementId
      )
    )
    .filter((location): location is PanelFindingLocation => Boolean(location))
    .sort(
      (first, second) =>
        first.sheetNumber - second.sheetNumber ||
        (first.objectId ?? "").localeCompare(second.objectId ?? "")
    );
}

function locationForRoute(
  route: PanelQualityRouteRef
): PanelFindingLocation {
  return {
    sheetId: route.sheetId,
    sheetNumber: route.sheetNumber,
    sheetName: route.sheetName,
    objectKind: "connection",
    objectId: route.connection.id
  };
}

function locationsForGraphFinding(
  index: PanelQualityIndex,
  finding: PanelConnectivityFinding
): PanelFindingLocation[] {
  if (finding.source) {
    const location = locationForSheet(
      index,
      finding.source.sheetId,
      "connection",
      finding.source.connectionId
    );
    if (location) return [location];
  }
  if (finding.assetId) {
    const locations = locationsForAsset(index, finding.assetId);
    if (locations.length > 0) return locations;
  }
  return firstDetailedLocation(index, "panel_context");
}

function graphFindingCategory(
  code: string
): PanelDrawingFindingCategory {
  if (code.includes("mapping") || code.includes("external_termination")) {
    return "external_termination";
  }
  if (code.includes("wire")) return "internal_wire";
  if (
    code.includes("pattern") ||
    code.includes("bridge") ||
    code.includes("bond") ||
    code.includes("distribution") ||
    code.includes("daisy")
  ) {
    return "connection_pattern";
  }
  if (code.includes("panel") || code.includes("context")) {
    return "panel_context";
  }
  if (code.includes("terminal") || code.includes("occupancy")) {
    return "terminal";
  }
  if (code.includes("asset") || code.includes("symbol")) {
    return "asset_identity";
  }
  return "linked_occurrence";
}

function graphFindingSeverity(
  finding: PanelConnectivityFinding
): PanelDrawingFindingSeverity {
  if (BLOCKING_GRAPH_CODES.has(finding.code)) return "blocking_error";
  if (WARNING_GRAPH_CODES.has(finding.code)) return "warning";
  return finding.severity === "error"
    ? "blocking_error"
    : finding.severity === "warning"
      ? "warning"
      : "information";
}

function makeFinding(input: {
  id: string;
  code: string;
  severity: PanelDrawingFindingSeverity;
  category: PanelDrawingFindingCategory;
  message: string;
  index: PanelQualityIndex;
  assetId?: string;
  terminal?: PanelTerminalSideRef;
  wireId?: string;
  internalWireId?: string;
  patternId?: string;
  locations?: PanelFindingLocation[];
  sourceFindingIds?: string[];
  repair?: PanelFindingRepairProposal;
}): PanelDrawingQualityFinding {
  return panelDrawingQualityFindingSchema.parse({
    id: input.id,
    code: input.code,
    severity: input.severity,
    category: input.category,
    message: input.message,
    panelAssetId: input.index.panelAssetId,
    assetId: input.assetId,
    assetTag: input.assetId
      ? input.index.graph.assetsById.get(input.assetId)?.tag
      : undefined,
    terminal: input.terminal,
    wireId: input.wireId,
    internalWireId: input.internalWireId,
    patternId: input.patternId,
    locations: input.locations ?? [],
    sourceFindingIds: input.sourceFindingIds ?? [],
    repair: input.repair
  });
}

function addFinding(
  findings: Map<string, PanelDrawingQualityFinding>,
  finding: PanelDrawingQualityFinding
): void {
  findings.set(finding.id, finding);
}

function routeEndpointProblem(
  index: PanelQualityIndex,
  route: PanelQualityRouteRef,
  role: "from" | "to"
): string | undefined {
  const endpoint = route.connection[role];
  const occurrence = index.graph.occurrencesBySheetPlacement.get(
    `${route.sheetId}:${endpoint.placementId}`
  );
  if (!occurrence) return `${role} placement ${endpoint.placementId} is missing`;
  const knownAnchors = occurrence.availableAnchorKeys ??
    occurrence.terminals.flatMap((terminal) =>
      terminal.anchors.map((anchor) => anchor.anchorKey)
    );
  if (knownAnchors.length > 0 && !knownAnchors.includes(endpoint.anchorKey)) {
    return `${role} anchor ${endpoint.anchorKey} is missing`;
  }
  return undefined;
}

function addGraphFindings(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>
): void {
  const graphFindings = [
    ...index.graph.findings,
    ...index.terminalCatalog.findings
  ];
  for (const sourceFinding of graphFindings) {
    if (DEDICATED_QUALITY_CODES.has(sourceFinding.code)) continue;
    const belongsToPanel =
      sourceFinding.panelAssetId === index.panelAssetId ||
      (sourceFinding.assetId
        ? index.associatedAssetIds.has(sourceFinding.assetId)
        : false);
    if (!belongsToPanel) continue;
    const terminal = sourceFinding.terminal;
    const staleMappingId = sourceFinding.code === "stale_terminal_mapping_source"
      ? sourceFinding.id.replace(/^stale_terminal_mapping:/, "")
      : undefined;
    addFinding(
      findings,
      makeFinding({
        id: findingId("graph", sourceFinding.id),
        code: sourceFinding.code,
        severity: graphFindingSeverity(sourceFinding),
        category: graphFindingCategory(sourceFinding.code),
        message: sourceFinding.message,
        index,
        assetId: sourceFinding.assetId,
        terminal,
        locations: locationsForGraphFinding(index, sourceFinding),
        sourceFindingIds: [sourceFinding.id],
        repair: staleMappingId
          ? {
              kind: "remove_stale_mapping",
              label: "Remove stale mapping",
              confirmation:
                "Remove this stale terminal-mapping override? The field connection will remain unchanged.",
              parameters: { mappingId: staleMappingId }
            }
          : undefined
      })
    );
  }
}

function addDuplicateAssetTags(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>
): void {
  const groups = new Map<
    string,
    Array<(typeof index.graph.source.assets)[number]>
  >();
  for (const asset of index.graph.source.assets) {
    const key = normalized(asset.tag);
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }
  for (const [tag, assets] of groups) {
    if (
      assets.length < 2 ||
      !assets.some((asset) => index.associatedAssetIds.has(asset.id))
    ) {
      continue;
    }
    addFinding(
      findings,
      makeFinding({
        id: findingId("duplicate_asset_tag", tag),
        code: "duplicate_asset_tag",
        severity: "blocking_error",
        category: "asset_identity",
        message: `${assets[0].tag} is assigned to ${assets.length} package assets.`,
        index,
        assetId: assets.find((asset) => index.associatedAssetIds.has(asset.id))?.id,
        locations: assets.flatMap((asset) => locationsForAsset(index, asset.id))
      })
    );
  }
}

function addDuplicateWireIds(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>
): void {
  const groups = new Map<
    string,
    Array<{
      id: string;
      wireId: string;
      location?: PanelFindingLocation;
      internalWireId?: string;
    }>
  >();
  for (const terminationId of
    index.graph.externalTerminationIdsByPanelAssetId.get(index.panelAssetId) ?? []) {
    const termination = index.graph.externalTerminationsById.get(terminationId);
    if (!termination?.wireId?.trim()) continue;
    const key = normalized(termination.wireId);
    groups.set(key, [
      ...(groups.get(key) ?? []),
      {
        id: termination.id,
        wireId: termination.wireId,
        location: locationForSheet(
          index,
          termination.source.sheetId,
          "connection",
          termination.source.connectionId
        )
      }
    ]);
  }
  for (const wire of index.graph.internalWiresById.values()) {
    if (wire.panelAssetId !== index.panelAssetId) continue;
    const key = normalized(wire.wireId);
    const route = index.internalWireRoutesByRecordId.get(wire.id)?.[0];
    groups.set(key, [
      ...(groups.get(key) ?? []),
      {
        id: wire.id,
        wireId: wire.wireId,
        internalWireId: wire.id,
        location: route
          ? locationForRoute(route)
          : firstDetailedLocation(index, "internal_wire", wire.id)[0]
      }
    ]);
  }
  for (const [key, records] of groups) {
    if (records.length < 2) continue;
    addFinding(
      findings,
      makeFinding({
        id: findingId("duplicate_wire_id", key),
        code: "duplicate_wire_id",
        severity: "blocking_error",
        category: "internal_wire",
        message: `${records[0].wireId} is assigned to ${records.length} distinct panel wire records.`,
        index,
        wireId: records[0].wireId,
        internalWireId: records.find((record) => record.internalWireId)?.internalWireId,
        locations: records
          .map((record) => record.location)
          .filter((location): location is PanelFindingLocation => Boolean(location))
      })
    );
  }
}

function addLinkedOccurrenceFindings(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>
): void {
  for (const assetId of index.associatedAssetIds) {
    const asset = index.graph.assetsById.get(assetId);
    if (!asset) {
      addFinding(
        findings,
        makeFinding({
          id: findingId("missing_asset_record", assetId),
          code: "missing_asset_record",
          severity: "blocking_error",
          category: "asset_identity",
          message: `${assetId} is referenced by panel occurrences but has no package asset record.`,
          index,
          assetId,
          locations: locationsForAsset(index, assetId)
        })
      );
      continue;
    }
    const occurrences = (index.graph.occurrencesByAssetId.get(assetId) ?? []).filter(
      (occurrence) => occurrence.occurrenceKind !== "layout"
    );
    for (const occurrence of occurrences) {
      const location = locationForSheet(
        index,
        occurrence.sheetId,
        "placement",
        occurrence.placementId
      );
      if (normalized(occurrence.tag) !== normalized(asset.tag)) {
        addFinding(
          findings,
          makeFinding({
            id: findingId("linked_tag_mismatch", assetId, occurrence.sheetId, occurrence.placementId),
            code: "linked_asset_tag_mismatch",
            severity: "blocking_error",
            category: "linked_occurrence",
            message: `${occurrence.tag} does not match linked asset ${asset.tag}.`,
            index,
            assetId,
            locations: location ? [location] : []
          })
        );
      }
      if (
        (asset.symbolId && occurrence.symbolId !== asset.symbolId) ||
        (asset.versionId && occurrence.versionId !== asset.versionId)
      ) {
        addFinding(
          findings,
          makeFinding({
            id: findingId("linked_symbol_mismatch", assetId, occurrence.sheetId, occurrence.placementId),
            code: "linked_asset_symbol_mismatch",
            severity: "blocking_error",
            category: "linked_occurrence",
            message: `${asset.tag} uses inconsistent approved symbol identity across linked occurrences.`,
            index,
            assetId,
            locations: location ? [location] : []
          })
        );
      }
    }
    const roles = new Set(occurrences.map((occurrence) => occurrence.role));
    if (roles.size > 1) {
      addFinding(
        findings,
        makeFinding({
          id: findingId("linked_role_mismatch", assetId),
          code: "linked_asset_role_mismatch",
          severity: "warning",
          category: "linked_occurrence",
          message: `${asset.tag} has linked occurrences with different drawing roles.`,
          index,
          assetId,
          locations: locationsForAsset(index, assetId)
        })
      );
    }
  }
}

function addDetailedSheetOccurrenceFindings(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>
): void {
  for (const sheet of index.detailedSheets) {
    const counts = new Map<
      string,
      Array<(typeof sheet.occurrences)[number]>
    >();
    for (const occurrence of sheet.occurrences) {
      if (!occurrence.assetId) continue;
      counts.set(occurrence.assetId, [
        ...(counts.get(occurrence.assetId) ?? []),
        occurrence
      ]);
      if (
        occurrence.assetId !== index.panelAssetId &&
        occurrence.containerAssetId !== index.panelAssetId
      ) {
        addFinding(
          findings,
          makeFinding({
            id: findingId("panel_context_mismatch", sheet.id, occurrence.placementId),
            code: "panel_occurrence_context_mismatch",
            severity: "blocking_error",
            category: "panel_context",
            message: `${occurrence.tag} is not associated with ${index.panelTag}.`,
            index,
            assetId: occurrence.assetId,
            locations: [
              {
                sheetId: sheet.id,
                sheetNumber: sheet.sheetNumber,
                sheetName: sheet.name,
                objectKind: "placement",
                objectId: occurrence.placementId
              }
            ]
          })
        );
      }
    }
    for (const [assetId, occurrences] of counts) {
      if (occurrences.length < 2) continue;
      const ordered = [...occurrences].sort((first, second) =>
        first.placementId.localeCompare(second.placementId)
      );
      const removable = ordered.slice(1).find((occurrence) =>
        sheet.connections.every(
          (connection) =>
            connection.from.placementId !== occurrence.placementId &&
            connection.to.placementId !== occurrence.placementId
        )
      );
      addFinding(
        findings,
        makeFinding({
          id: findingId("duplicate_asset_occurrence", sheet.id, assetId),
          code: "duplicate_panel_asset_representation",
          severity: "blocking_error",
          category: "asset_identity",
          message: `${index.graph.assetsById.get(assetId)?.tag ?? assetId} is represented more than once on this Detailed Panel Drawing.`,
          index,
          assetId,
          locations: ordered.map((occurrence) => ({
            sheetId: sheet.id,
            sheetNumber: sheet.sheetNumber,
            sheetName: sheet.name,
            objectKind: "placement" as const,
            objectId: occurrence.placementId
          })),
          repair: removable
            ? {
                kind: "remove_unreferenced_duplicate_occurrence",
                label: "Remove duplicate occurrence",
                confirmation: `Remove the unreferenced ${removable.tag} occurrence from Sheet ${sheet.sheetNumber}?`,
                parameters: {
                  sheetId: sheet.id,
                  placementId: removable.placementId,
                  assetId
                }
              }
            : undefined
        })
      );
    }
  }
}

function addExternalTerminationFindings(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>
): void {
  for (const terminationId of
    index.graph.externalTerminationIdsByPanelAssetId.get(index.panelAssetId) ?? []) {
    const termination = index.graph.externalTerminationsById.get(terminationId);
    if (!termination) continue;
    const location = locationForSheet(
      index,
      termination.source.sheetId,
      "connection",
      termination.source.connectionId
    );
    if (termination.status !== "resolved" || !termination.target) {
      addFinding(
        findings,
        makeFinding({
          id: findingId("unresolved_external_termination", termination.id),
          code: "unresolved_external_termination",
          severity: "blocking_error",
          category: "external_termination",
          message:
            termination.unresolvedReason ??
            `${termination.wireId ?? termination.id} does not resolve to a panel terminal.`,
          index,
          wireId: termination.wireId,
          locations: location ? [location] : []
        })
      );
    }
    if (termination.mappingMode === "manual" && termination.mappingId) {
      const isRedundant =
        termination.inferredTarget &&
        termination.target &&
        terminalSideNodeId(termination.inferredTarget) ===
          terminalSideNodeId(termination.target);
      addFinding(
        findings,
        makeFinding({
          id: findingId(
            isRedundant ? "redundant_terminal_mapping" : "manual_terminal_mapping",
            termination.mappingId
          ),
          code: isRedundant
            ? "redundant_terminal_mapping"
            : "manual_terminal_mapping",
          severity: "information",
          category: "external_termination",
          message: isRedundant
            ? `${termination.wireId ?? termination.id} has a manual override identical to its automatic mapping.`
            : `${termination.wireId ?? termination.id} uses an engineer-selected terminal mapping.`,
          index,
          terminal: termination.target,
          wireId: termination.wireId,
          locations: location ? [location] : [],
          repair: isRedundant
            ? {
                kind: "remove_redundant_mapping",
                label: "Use automatic mapping",
                confirmation:
                  "Remove the redundant override and use the identical automatic terminal mapping?",
                parameters: { mappingId: termination.mappingId }
              }
            : undefined
        })
      );
    }
  }
}

function addRequiredTerminalFindings(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>
): void {
  for (const terminal of index.graph.terminalsById.values()) {
    if (!index.associatedAssetIds.has(terminal.ref.assetId)) continue;
    const requiredSides = new Set(terminal.requiredSides ?? []);
    const externalRef = { ...terminal.ref, side: "external" as const };
    const external = index.terminalCatalog.occupancyBySideId.get(
      terminalSideNodeId(externalRef)
    );
    if (
      terminal.supportedSides.includes("external") &&
      terminal.supportedSides.includes("internal") &&
      (external?.conductorOccupants.length ?? 0) > 0
    ) {
      requiredSides.add("internal");
    }
    for (const side of requiredSides) {
      const ref = { ...terminal.ref, side };
      const occupancy = index.terminalCatalog.occupancyBySideId.get(
        terminalSideNodeId(ref)
      );
      if (occupancy && occupancy.status !== "available") continue;
      const asset = index.graph.assetsById.get(terminal.ref.assetId);
      addFinding(
        findings,
        makeFinding({
          id: findingId("required_terminal_unconnected", terminalSideNodeId(ref)),
          code: "required_terminal_unconnected",
          severity: "blocking_error",
          category: "terminal",
          message: `${asset?.tag ?? terminal.ref.assetId}:${terminal.label}/${side} requires a connection.`,
          index,
          assetId: terminal.ref.assetId,
          terminal: ref,
          locations: locationsForAsset(index, terminal.ref.assetId)
        })
      );
    }
  }
}

function addRouteFinding(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>,
  route: PanelQualityRouteRef,
  input: {
    code: string;
    message: string;
    patternId?: string;
    internalWireId?: string;
    repair?: PanelFindingRepairProposal;
  }
): void {
  addFinding(
    findings,
    makeFinding({
      id: findingId(input.code, route.sheetId, route.connection.id),
      code: input.code,
      severity: "blocking_error",
      category: "route",
      message: input.message,
      index,
      patternId: input.patternId,
      internalWireId: input.internalWireId,
      locations: [locationForRoute(route)],
      repair: input.repair
    })
  );
}

function addRouteFindings(
  index: PanelQualityIndex,
  findings: Map<string, PanelDrawingQualityFinding>
): void {
  const validPatternIds = new Set([
    ...index.graph.bridgesById.keys(),
    ...index.graph.bondsById.keys()
  ]);
  for (const sheet of index.graph.source.sheets) {
    for (const connection of sheet.connections) {
      if (!connection.panelConnectionId && !connection.panelPatternId) continue;
      const route = {
        sheetId: sheet.id,
        sheetNumber: sheet.sheetNumber,
        sheetName: sheet.name,
        connection
      };
      const orphanWire =
        connection.panelConnectionId &&
        !index.graph.internalWiresById.has(connection.panelConnectionId);
      const orphanPattern =
        connection.panelPatternId && !validPatternIds.has(connection.panelPatternId);
      if (orphanWire || orphanPattern) {
        addRouteFinding(index, findings, route, {
          code: "orphan_panel_route",
          message: "This route references a physical wire or connection pattern that no longer exists.",
          patternId: connection.panelPatternId,
          internalWireId: connection.panelConnectionId,
          repair: {
            kind: "remove_orphan_route",
            label: "Remove orphan route",
            confirmation: `Remove the orphan route from Sheet ${sheet.sheetNumber}?`,
            parameters: { sheetId: sheet.id, connectionId: connection.id }
          }
        });
      }
      for (const role of ["from", "to"] as const) {
        const problem = routeEndpointProblem(index, route, role);
        if (problem) {
          addRouteFinding(index, findings, route, {
            code: "broken_route_endpoint",
            message: `This route has a broken endpoint: ${problem}.`,
            patternId: connection.panelPatternId,
            internalWireId: connection.panelConnectionId
          });
        }
      }
      const routePanelId = sheet.panelDrawingContext?.panelAssetId;
      const recordPanelId = connection.panelConnectionId
        ? index.graph.internalWiresById.get(connection.panelConnectionId)?.panelAssetId
        : connection.panelPatternId
          ? (index.graph.bridgesById.get(connection.panelPatternId) ??
              index.graph.bondsById.get(connection.panelPatternId))?.panelAssetId
          : undefined;
      if (recordPanelId === index.panelAssetId && routePanelId !== index.panelAssetId) {
        addRouteFinding(index, findings, route, {
          code: "route_panel_context_mismatch",
          message: `This ${index.panelTag} route is represented on a sheet with a different or missing panel context.`,
          patternId: connection.panelPatternId,
          internalWireId: connection.panelConnectionId
        });
      }
    }
  }

  for (const wire of index.graph.internalWiresById.values()) {
    if (wire.panelAssetId !== index.panelAssetId) continue;
    const routes = index.internalWireRoutesByRecordId.get(wire.id) ?? [];
    if (!wire.domain || wire.domain === "unknown") {
      addFinding(
        findings,
        makeFinding({
          id: findingId("internal_wire_domain_unverified", wire.id),
          code: "internal_wire_domain_unverified",
          severity: "warning",
          category: "internal_wire",
          message: `${wire.wireId} has no verified electrical domain.`,
          index,
          wireId: wire.wireId,
          internalWireId: wire.id,
          locations:
            routes.length > 0
              ? routes.map(locationForRoute)
              : firstDetailedLocation(index, "internal_wire", wire.id)
        })
      );
    }
    if (routes.length === 0) {
      addFinding(
        findings,
        makeFinding({
          id: findingId("unrepresented_internal_wire", wire.id),
          code: "unrepresented_internal_wire",
          severity: "warning",
          category: "internal_wire",
          message: `${wire.wireId} has no Detailed Panel route representation.`,
          index,
          wireId: wire.wireId,
          internalWireId: wire.id,
          locations: firstDetailedLocation(index, "internal_wire", wire.id)
        })
      );
    }
    const routesBySheet = new Map<string, PanelQualityRouteRef[]>();
    for (const route of routes) {
      routesBySheet.set(route.sheetId, [
        ...(routesBySheet.get(route.sheetId) ?? []),
        route
      ]);
    }
    if (routesBySheet.size > 1) {
      addFinding(
        findings,
        makeFinding({
          id: findingId("internal_wire_multiple_representations", wire.id),
          code: "internal_wire_multiple_representations",
          severity: "information",
          category: "internal_wire",
          message: `${wire.wireId} is validly represented on ${routesBySheet.size} Detailed Panel sheets.`,
          index,
          wireId: wire.wireId,
          internalWireId: wire.id,
          locations: routes.map(locationForRoute)
        })
      );
    }
    for (const [sheetId, sheetRoutes] of routesBySheet) {
      if (sheetRoutes.length < 2) continue;
      const ordered = [...sheetRoutes].sort((first, second) =>
        first.connection.id.localeCompare(second.connection.id)
      );
      const duplicate = ordered[1];
      addFinding(
        findings,
        makeFinding({
          id: findingId("duplicate_internal_wire_route", wire.id, sheetId),
          code: "duplicate_internal_wire_route",
          severity: "blocking_error",
          category: "route",
          message: `${wire.wireId} is represented more than once on Sheet ${duplicate.sheetNumber}.`,
          index,
          wireId: wire.wireId,
          internalWireId: wire.id,
          locations: ordered.map(locationForRoute),
          repair: {
            kind: "remove_duplicate_route",
            label: "Remove duplicate route",
            confirmation: `Remove the extra ${wire.wireId} route from Sheet ${duplicate.sheetNumber}?`,
            parameters: {
              sheetId: duplicate.sheetId,
              connectionId: duplicate.connection.id,
              canonicalId: wire.id
            }
          }
        })
      );
    }
  }

  for (const pattern of [
    ...index.graph.bridgesById.values(),
    ...index.graph.bondsById.values()
  ]) {
    if (pattern.panelAssetId !== index.panelAssetId) continue;
    const routes = index.patternRoutesByRecordId.get(pattern.id) ?? [];
    if (routes.length === 0) {
      addFinding(
        findings,
        makeFinding({
          id: findingId("unrepresented_connection_pattern", pattern.id),
          code: "unrepresented_connection_pattern",
          severity: "warning",
          category: "connection_pattern",
          message: `${pattern.patternCode ?? pattern.id} has no Detailed Panel route representation.`,
          index,
          patternId: pattern.id,
          locations: firstDetailedLocation(index, "connection_pattern", pattern.id)
        })
      );
    }
    if (new Set(routes.map((route) => route.sheetId)).size > 1) {
      addFinding(
        findings,
        makeFinding({
          id: findingId("pattern_multiple_representations", pattern.id),
          code: "pattern_multiple_representations",
          severity: "information",
          category: "connection_pattern",
          message: `${pattern.patternCode ?? pattern.id} is validly represented on multiple Detailed Panel sheets.`,
          index,
          patternId: pattern.id,
          locations: routes.map(locationForRoute)
        })
      );
    }
    const segmentGroups = new Map<string, PanelQualityRouteRef[]>();
    for (const route of routes) {
      if (!route.connection.panelPatternSegmentId) continue;
      const key = `${route.sheetId}:${route.connection.panelPatternSegmentId}`;
      segmentGroups.set(key, [...(segmentGroups.get(key) ?? []), route]);
    }
    for (const segmentRoutes of segmentGroups.values()) {
      if (segmentRoutes.length < 2) continue;
      const ordered = [...segmentRoutes].sort((first, second) =>
        first.connection.id.localeCompare(second.connection.id)
      );
      const duplicate = ordered[1];
      addFinding(
        findings,
        makeFinding({
          id: findingId("duplicate_pattern_route", pattern.id, duplicate.sheetId, duplicate.connection.panelPatternSegmentId),
          code: "duplicate_pattern_route",
          severity: "blocking_error",
          category: "route",
          message: `${pattern.patternCode ?? pattern.id} contains a duplicate visual segment on Sheet ${duplicate.sheetNumber}.`,
          index,
          patternId: pattern.id,
          locations: ordered.map(locationForRoute),
          repair: {
            kind: "remove_duplicate_route",
            label: "Remove duplicate segment",
            confirmation: `Remove the extra pattern segment from Sheet ${duplicate.sheetNumber}?`,
            parameters: {
              sheetId: duplicate.sheetId,
              connectionId: duplicate.connection.id,
              canonicalId: pattern.id
            }
          }
        })
      );
    }
  }
}

export function runPanelDrawingQualityChecks(
  index: PanelQualityIndex
): PanelDrawingQualityReport {
  const findings = new Map<string, PanelDrawingQualityFinding>();
  addGraphFindings(index, findings);
  addDuplicateAssetTags(index, findings);
  addDuplicateWireIds(index, findings);
  addLinkedOccurrenceFindings(index, findings);
  addDetailedSheetOccurrenceFindings(index, findings);
  addExternalTerminationFindings(index, findings);
  addRequiredTerminalFindings(index, findings);
  addRouteFindings(index, findings);

  const ordered = [...findings.values()].sort(
    (first, second) =>
      ["blocking_error", "warning", "information"].indexOf(first.severity) -
        ["blocking_error", "warning", "information"].indexOf(second.severity) ||
      first.category.localeCompare(second.category) ||
      first.id.localeCompare(second.id)
  );
  const counts = {
    blockingErrors: ordered.filter(
      (finding) => finding.severity === "blocking_error"
    ).length,
    warnings: ordered.filter((finding) => finding.severity === "warning").length,
    information: ordered.filter(
      (finding) => finding.severity === "information"
    ).length
  };
  return panelDrawingQualityReportSchema.parse({
    panelAssetId: index.panelAssetId,
    panelTag: index.panelTag,
    status:
      counts.blockingErrors > 0
        ? "blocked"
        : counts.warnings > 0
          ? "review_required"
          : "clean",
    counts,
    findings: ordered,
    canApprove: counts.blockingErrors === 0
  });
}

export function runPackagePanelDrawingQualityChecks(
  graph: PanelQualityIndex["graph"]
): PackagePanelDrawingQualityReport {
  const sharedIndex = buildPanelQualitySharedIndex(graph);
  const panelIds = new Map<string, number>();
  for (const sheet of graph.source.sheets) {
    const panelAssetId = sheet.panelDrawingContext?.panelAssetId;
    if (panelAssetId && !panelIds.has(panelAssetId)) {
      panelIds.set(panelAssetId, sheet.sheetNumber);
    }
  }
  const reports = [...panelIds]
    .sort(
      ([firstId, firstSheet], [secondId, secondSheet]) =>
        firstSheet - secondSheet || firstId.localeCompare(secondId)
    )
    .map(([panelAssetId]) =>
      runPanelDrawingQualityChecks(
        buildPanelQualityIndex({ graph, panelAssetId, sharedIndex })
      )
    );
  const findings = reports.flatMap((report) => report.findings);
  const counts = {
    blockingErrors: findings.filter(
      (finding) => finding.severity === "blocking_error"
    ).length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    information: findings.filter(
      (finding) => finding.severity === "information"
    ).length
  };
  return packagePanelDrawingQualityReportSchema.parse({
    reports,
    counts,
    canApprove: counts.blockingErrors === 0,
    firstBlockingFinding: findings.find(
      (finding) => finding.severity === "blocking_error"
    )
  });
}
