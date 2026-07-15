import { describe, expect, it } from "vitest";
import {
  applyApprovedPanelAgentPlan,
  buildPackageConnectivityGraph,
  getPanelAgentPlanDigest,
  inspectPanelAgentContext,
  listUnresolvedPanelTerminations,
  proposeExternalTerminationMappingPlan,
  proposeInternalWirePlan,
  validatePanelAgentPlan
} from "../api/public";
import { panelWiringSourcePackageSchema } from "../data/schema";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

const DRAWING_ID = "drawing_agent_contract";
const REVISION = "2026-07-11T12:00:00.000Z";

function sourceWithDetailedPanel() {
  const source = createGenericPanelWiringSource();
  const occurrenceFor = (assetId: string, index: number) => {
    const sourceOccurrence = source.sheets[index].occurrences.find(
      (occurrence) => occurrence.assetId === assetId
    )!;
    return {
      ...sourceOccurrence,
      sheetId: "sheet_detailed",
      placementId: `detail_strip_${index + 1}`,
      occurrenceKind: "wiring" as const
    };
  };
  return panelWiringSourcePackageSchema.parse({
    ...source,
    sheets: [
      ...source.sheets,
      {
        id: "sheet_detailed",
        sheetNumber: source.sheets.length + 1,
        name: "ENC-001 Detailed Panel Drawing",
        kind: "drawing",
        panelDrawingContext: {
          kind: "detailed_panel_wiring",
          panelAssetId: GENERIC_PANEL_ASSET_ID
        },
        occurrences: [
          occurrenceFor(GENERIC_TERMINAL_ASSET_IDS[0], 0),
          occurrenceFor(GENERIC_TERMINAL_ASSET_IDS[1], 1)
        ],
        connections: []
      }
    ]
  });
}

function identity() {
  return {
    drawingId: DRAWING_ID,
    panelAssetId: GENERIC_PANEL_ASSET_ID,
    baseUpdatedAt: REVISION
  };
}

describe("panel agent plans", () => {
  it("returns deterministic panel context and unresolved termination records", () => {
    const source = createGenericPanelWiringSource();
    const broken = panelWiringSourcePackageSchema.parse({
      ...source,
      sheets: source.sheets.map((sheet, index) =>
        index === 0
          ? {
              ...sheet,
              connections: sheet.connections.map((connection, connectionIndex) =>
                connectionIndex === 0
                  ? {
                      ...connection,
                      to: { ...connection.to, anchorKey: "MISSING_ANCHOR" }
                    }
                  : connection
              )
            }
          : sheet
      )
    });

    const context = inspectPanelAgentContext(broken, GENERIC_PANEL_ASSET_ID);
    const unresolved = listUnresolvedPanelTerminations(
      broken,
      GENERIC_PANEL_ASSET_ID
    );

    expect(context).toMatchObject({
      panelTag: "ENC-001",
      terminalCount: 20,
      externalTerminationCount: 12,
      unresolvedTerminationCount: 1
    });
    expect(unresolved).toEqual([
      expect.objectContaining({
        sourceSheetNumber: 1,
        wireId: "CBL-001-W1",
        reason: expect.any(String)
      })
    ]);
  });

  it("creates deterministic, digest-bound mapping plans and revalidates them", async () => {
    const source = createGenericPanelWiringSource();
    const termination = [...buildPackageConnectivityGraph(source).externalTerminationsById.values()][0];
    const input = {
      terminationId: termination.id,
      target: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T4",
        side: "external" as const
      }
    };
    const first = await proposeExternalTerminationMappingPlan(
      source,
      identity(),
      input
    );
    const second = await proposeExternalTerminationMappingPlan(
      source,
      identity(),
      input
    );
    const validation = await validatePanelAgentPlan(source, first, REVISION);

    expect(first).toEqual(second);
    expect(await getPanelAgentPlanDigest(first)).toBe(first.digest);
    expect(first.mutationPreview).toEqual([
      expect.objectContaining({
        kind: "upsert-terminal-mapping",
        mapping: expect.objectContaining({ origin: "agent" })
      })
    ]);
    expect(validation.valid).toBe(true);
  });

  it("rejects stale or modified plans and protects issued drawings", async () => {
    const source = createGenericPanelWiringSource();
    const termination = [...buildPackageConnectivityGraph(source).externalTerminationsById.values()][0];
    const plan = await proposeExternalTerminationMappingPlan(source, identity(), {
      terminationId: termination.id,
      target: {
        assetId: GENERIC_TERMINAL_ASSET_IDS[0],
        terminalKey: "T4",
        side: "external"
      }
    });
    const stale = await validatePanelAgentPlan(
      source,
      plan,
      "2026-07-11T13:00:00.000Z"
    );
    const modified = {
      ...plan,
      affectedIds: [...plan.affectedIds, "unexpected"]
    };
    const modifiedValidation = await validatePanelAgentPlan(
      source,
      modified,
      REVISION
    );

    expect(stale.valid).toBe(false);
    expect(stale.errors.join(" ")).toContain("stale");
    expect(modifiedValidation.valid).toBe(false);
    expect(modifiedValidation.errors.join(" ")).toContain("digest");
    await expect(
      applyApprovedPanelAgentPlan(source, plan, {
        drawingStatus: "approved",
        currentUpdatedAt: REVISION,
        saved: true,
        detailedPanelDrawingsEnabled: true,
        approvedDigest: plan.digest
      })
    ).rejects.toThrow(/Approved or archived/);
    await expect(
      applyApprovedPanelAgentPlan(source, plan, {
        drawingStatus: "needs_review",
        currentUpdatedAt: REVISION,
        saved: true,
        detailedPanelDrawingsEnabled: false,
        approvedDigest: plan.digest
      })
    ).rejects.toThrow(/disabled/);
  });

  it("requires exact occurrence and anchor identity for proposed internal wires", async () => {
    const source = sourceWithDetailedPanel();
    const plan = await proposeInternalWirePlan(source, identity(), {
      sheetId: "sheet_detailed",
      from: {
        terminal: {
          assetId: GENERIC_TERMINAL_ASSET_IDS[0],
          terminalKey: "T1",
          side: "internal"
        },
        placementId: "detail_strip_1",
        anchorKey: "T1_TOP"
      },
      to: {
        terminal: {
          assetId: GENERIC_TERMINAL_ASSET_IDS[1],
          terminalKey: "T1",
          side: "internal"
        },
        placementId: "detail_strip_2",
        anchorKey: "T1_TOP"
      }
    });
    const applied = await applyApprovedPanelAgentPlan(source, plan, {
      drawingStatus: "needs_review",
      currentUpdatedAt: REVISION,
      saved: true,
      detailedPanelDrawingsEnabled: true,
      approvedDigest: plan.digest
    });

    expect(plan.mutationPreview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "upsert-internal-wire",
          wire: expect.objectContaining({ origin: "agent" })
        })
      ])
    );
    expect(applied.requiredStatus).toBe("needs_review");
    await expect(
      proposeInternalWirePlan(source, identity(), {
        sheetId: "sheet_detailed",
        from: {
          terminal: {
            assetId: GENERIC_TERMINAL_ASSET_IDS[0],
            terminalKey: "T1",
            side: "internal"
          },
          placementId: "wrong_occurrence",
          anchorKey: "T1_TOP"
        },
        to: {
          terminal: {
            assetId: GENERIC_TERMINAL_ASSET_IDS[1],
            terminalKey: "T1",
            side: "internal"
          },
          placementId: "detail_strip_2",
          anchorKey: "T1_TOP"
        }
      })
    ).rejects.toThrow(/occurrence/);
  });
});
