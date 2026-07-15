import {
  panelAgentApplicationContextSchema,
  panelAgentApplicationResultSchema,
  panelAgentContextSchema,
  panelAgentOperationSchema,
  panelAgentPlanSchema,
  panelAgentPlanValidationSchema,
  unresolvedPanelTerminationSchema,
  type PanelAgentApplicationContext,
  type PanelAgentApplicationResult,
  type PanelAgentContext,
  type PanelAgentOperation,
  type PanelAgentPlan,
  type PanelAgentPlanValidation,
  type UnresolvedPanelTermination
} from "../../data/agent-schema";
import {
  panelWiringSourcePackageSchema,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelWiringCommandResult
} from "../../types";
import { buildPackageConnectivityGraph } from "../services/connectivity-graph";
import { createInternalPanelWire } from "../services/internal-panel-wires";
import { mapExternalTerminationToTerminal } from "./external-termination-mapping";

type PlanIdentity = {
  drawingId: string;
  panelAssetId: string;
  baseUpdatedAt: string;
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function planPayload(plan: Omit<PanelAgentPlan, "digest"> | PanelAgentPlan) {
  const { digest, ...payload } = plan as PanelAgentPlan;
  void digest;
  return payload;
}

export async function getPanelAgentPlanDigest(
  plan: Omit<PanelAgentPlan, "digest"> | PanelAgentPlan
): Promise<string> {
  return sha256(planPayload(plan));
}

function warningRows(findings: PanelConnectivityFinding[]) {
  return findings
    .filter((finding) => finding.severity !== "error")
    .map((finding) => ({ code: finding.code, message: finding.message }))
    .sort(
      (first, second) =>
        first.code.localeCompare(second.code) ||
        first.message.localeCompare(second.message)
    );
}

function commandErrors(result: PanelWiringCommandResult): string[] {
  return result.warnings
    .filter((finding) => finding.severity === "error")
    .map((finding) => finding.message);
}

function assertPanel(source: PanelWiringSourcePackage, panelAssetId: string) {
  const graph = buildPackageConnectivityGraph(source);
  if (!graph.panelAssetIds.has(panelAssetId)) {
    throw new Error("The requested panel identity is not available in this package.");
  }
  return graph;
}

function assertWireEndpointOccurrence(
  source: PanelWiringSourcePackage,
  operation: Extract<PanelAgentOperation, { kind: "internal_wire" }>,
  endpoint: "from" | "to"
): void {
  const expected = operation[endpoint];
  const sheet = source.sheets.find((candidate) => candidate.id === operation.sheetId);
  if (sheet?.panelDrawingContext?.panelAssetId === undefined) {
    throw new Error("The proposed wire sheet is not a Detailed Panel Drawing.");
  }
  const occurrence = sheet.occurrences.find(
    (candidate) => candidate.placementId === expected.placementId
  );
  if (!occurrence || occurrence.assetId !== expected.terminal.assetId) {
    throw new Error(`The ${endpoint} occurrence no longer represents the specified asset.`);
  }
  const terminal = occurrence.terminals.find(
    (candidate) => candidate.terminalKey === expected.terminal.terminalKey
  );
  const anchor = terminal?.anchors.find(
    (candidate) =>
      candidate.anchorKey === expected.anchorKey &&
      candidate.sideHint === expected.terminal.side
  );
  if (!anchor) {
    throw new Error(`The ${endpoint} terminal side no longer resolves to the specified anchor.`);
  }
}

function executeOperation(
  source: PanelWiringSourcePackage,
  panelAssetId: string,
  inputOperation: PanelAgentOperation
): PanelWiringCommandResult {
  const operation = panelAgentOperationSchema.parse(inputOperation);
  const graph = assertPanel(source, panelAssetId);

  if (operation.kind === "external_termination_mapping") {
    const termination = graph.externalTerminationsById.get(operation.terminationId);
    if (
      !termination ||
      termination.panelAssetId !== panelAssetId ||
      canonicalJson(termination.source) !== canonicalJson(operation.source)
    ) {
      throw new Error("The proposed external termination provenance is stale or invalid.");
    }
    return mapExternalTerminationToTerminal(source, {
      panelAssetId,
      terminationId: operation.terminationId,
      target: operation.target,
      origin: "agent"
    });
  }

  const sheet = source.sheets.find((candidate) => candidate.id === operation.sheetId);
  if (sheet?.panelDrawingContext?.panelAssetId !== panelAssetId) {
    throw new Error("The proposed wire sheet belongs to a different panel context.");
  }
  assertWireEndpointOccurrence(source, operation, "from");
  assertWireEndpointOccurrence(source, operation, "to");
  return createInternalPanelWire(source, {
    panelAssetId,
    from: operation.from.terminal,
    to: operation.to.terminal,
    wireId: operation.wireId,
    attributes: operation.attributes,
    origin: "agent"
  });
}

function operationAffectedIds(operation: PanelAgentOperation): string[] {
  if (operation.kind === "external_termination_mapping") {
    return [
      operation.terminationId,
      operation.source.sheetId,
      operation.source.connectionId,
      operation.source.placementId,
      operation.target.assetId,
      operation.target.terminalKey
    ];
  }
  return [
    operation.sheetId,
    operation.from.placementId,
    operation.from.anchorKey,
    operation.from.terminal.assetId,
    operation.from.terminal.terminalKey,
    operation.to.placementId,
    operation.to.anchorKey,
    operation.to.terminal.assetId,
    operation.to.terminal.terminalKey
  ];
}

async function proposePlan(
  inputSource: PanelWiringSourcePackage,
  identity: PlanIdentity,
  operation: PanelAgentOperation
): Promise<PanelAgentPlan> {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const parsedOperation = panelAgentOperationSchema.parse(operation);
  const result = executeOperation(source, identity.panelAssetId, parsedOperation);
  const errors = commandErrors(result);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
  if (result.mutations.length === 0) {
    throw new Error("The proposed operation would not change the drawing.");
  }
  const payload = {
    schemaVersion: 1 as const,
    drawingId: identity.drawingId,
    panelAssetId: identity.panelAssetId,
    baseUpdatedAt: identity.baseUpdatedAt,
    operation: parsedOperation,
    mutationPreview: result.mutations,
    warnings: warningRows(result.warnings),
    affectedIds: [
      ...new Set([...result.affectedIds, ...operationAffectedIds(parsedOperation)])
    ].sort()
  };
  return panelAgentPlanSchema.parse({
    ...payload,
    digest: await getPanelAgentPlanDigest(payload)
  });
}

export function inspectPanelAgentContext(
  inputSource: PanelWiringSourcePackage,
  panelAssetId: string
): PanelAgentContext {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const graph = assertPanel(source, panelAssetId);
  const panel = graph.assetsById.get(panelAssetId);
  const terminationIds = graph.externalTerminationIdsByPanelAssetId.get(panelAssetId) ?? [];
  const unresolvedTerminationCount = terminationIds.filter((id) => {
    const termination = graph.externalTerminationsById.get(id);
    return !termination?.target || termination.status === "unresolved";
  }).length;
  return panelAgentContextSchema.parse({
    panelAssetId,
    panelTag: panel?.tag ?? panelAssetId,
    panelTitle: panel?.title ?? "",
    detailedSheetIds: source.sheets
      .filter((sheet) => sheet.panelDrawingContext?.panelAssetId === panelAssetId)
      .map((sheet) => sheet.id)
      .sort(),
    associatedAssetIds: [...(graph.assetIdsByPanelAssetId.get(panelAssetId) ?? [])].sort(),
    terminalCount: [...graph.terminalsById.values()].filter((terminal) =>
      graph.assetIdsByPanelAssetId.get(panelAssetId)?.has(terminal.ref.assetId)
    ).length,
    externalTerminationCount: terminationIds.length,
    unresolvedTerminationCount,
    internalWireCount: [...graph.internalWiresById.values()].filter(
      (wire) => wire.panelAssetId === panelAssetId
    ).length,
    findingCount: graph.findings.filter(
      (finding) => finding.panelAssetId === panelAssetId
    ).length
  });
}

export function listUnresolvedPanelTerminations(
  inputSource: PanelWiringSourcePackage,
  panelAssetId: string
): UnresolvedPanelTermination[] {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const graph = assertPanel(source, panelAssetId);
  return (graph.externalTerminationIdsByPanelAssetId.get(panelAssetId) ?? [])
    .flatMap((id) => {
      const termination = graph.externalTerminationsById.get(id);
      if (!termination || (termination.target && termination.status === "resolved")) {
        return [];
      }
      return [
        unresolvedPanelTerminationSchema.parse({
          terminationId: termination.id,
          source: termination.source,
          sourceSheetId: termination.sourceSheet.id,
          sourceSheetNumber: termination.sourceSheet.number,
          sourceSheetName: termination.sourceSheet.name,
          wireId: termination.wireId,
          cableTag: termination.cableTag,
          conductorKey: termination.conductorKey,
          reason: termination.unresolvedReason ?? "The field termination has no canonical target."
        })
      ];
    })
    .sort(
      (first, second) =>
        first.sourceSheetNumber - second.sourceSheetNumber ||
        first.terminationId.localeCompare(second.terminationId)
    );
}

export function proposeExternalTerminationMappingPlan(
  source: PanelWiringSourcePackage,
  identity: PlanIdentity,
  input: {
    terminationId: string;
    target: Extract<PanelAgentOperation, { kind: "external_termination_mapping" }>["target"];
  }
): Promise<PanelAgentPlan> {
  const graph = assertPanel(panelWiringSourcePackageSchema.parse(source), identity.panelAssetId);
  const termination = graph.externalTerminationsById.get(input.terminationId);
  if (!termination) {
    throw new Error("The requested external termination is not available.");
  }
  return proposePlan(source, identity, {
    kind: "external_termination_mapping",
    terminationId: input.terminationId,
    source: termination.source,
    target: input.target
  });
}

export function proposeInternalWirePlan(
  source: PanelWiringSourcePackage,
  identity: PlanIdentity,
  input: Omit<Extract<PanelAgentOperation, { kind: "internal_wire" }>, "kind">
): Promise<PanelAgentPlan> {
  return proposePlan(source, identity, { kind: "internal_wire", ...input });
}

export async function validatePanelAgentPlan(
  inputSource: PanelWiringSourcePackage,
  inputPlan: PanelAgentPlan,
  currentUpdatedAt: string
): Promise<PanelAgentPlanValidation> {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const plan = panelAgentPlanSchema.parse(inputPlan);
  const errors: string[] = [];
  let result: PanelWiringCommandResult = {
    mutations: [],
    warnings: [],
    affectedIds: []
  };

  if (plan.baseUpdatedAt !== currentUpdatedAt) {
    errors.push("The plan was prepared against a stale drawing revision.");
  }
  if ((await getPanelAgentPlanDigest(plan)) !== plan.digest) {
    errors.push("The plan digest does not match its approved payload.");
  }
  try {
    result = executeOperation(source, plan.panelAssetId, plan.operation);
    errors.push(...commandErrors(result));
    if (canonicalJson(result.mutations) !== canonicalJson(plan.mutationPreview)) {
      errors.push("The current engineering mutations differ from the approved preview.");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "The plan could not be revalidated.");
  }

  return panelAgentPlanValidationSchema.parse({
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: warningRows(result.warnings),
    mutations: errors.length === 0 ? result.mutations : [],
    affectedIds: errors.length === 0 ? plan.affectedIds : []
  });
}

export async function applyApprovedPanelAgentPlan(
  inputSource: PanelWiringSourcePackage,
  inputPlan: PanelAgentPlan,
  inputContext: PanelAgentApplicationContext
): Promise<PanelAgentApplicationResult> {
  const context = panelAgentApplicationContextSchema.parse(inputContext);
  const plan = panelAgentPlanSchema.parse(inputPlan);
  if (!context.detailedPanelDrawingsEnabled) {
    throw new Error("Detailed Panel mutations are disabled in this deployment.");
  }
  if (!context.saved) {
    throw new Error("Save the current drawing before applying an approved agent plan.");
  }
  if (context.drawingStatus === "approved" || context.drawingStatus === "archived") {
    throw new Error("Approved or archived drawings cannot receive agent mutations.");
  }
  if (context.approvedDigest !== plan.digest) {
    throw new Error("The explicitly approved digest does not match this plan.");
  }
  const validation = await validatePanelAgentPlan(
    inputSource,
    plan,
    context.currentUpdatedAt
  );
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }
  return panelAgentApplicationResultSchema.parse({
    mutations: validation.mutations,
    warnings: validation.warnings,
    affectedIds: validation.affectedIds,
    requiredStatus: "needs_review"
  });
}
