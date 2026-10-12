import { describe, expect, it, vi } from "vitest";
import {
  buildSavedPanelAnalysis,
  createPanelAnalysisRules,
  comparePanelTerminalElectricalRoles,
  filterPanelAnalysisFindingGroups,
  groupPanelAnalysisFindings,
  panelAnalysisResultSchema,
  panelAnalysisFindingSchema,
  resolvePanelAnalysisNavigation,
  runPanelAnalysisRules,
  resolvePanelTerminalElectricalRole,
  type PanelAnalysisFindingDraft,
  type PanelAnalysisRule,
  type PanelAnalysisRuleContext
} from "../api/public";
import { createDefaultDrawingModel } from "@/features/drawing_canvas/data/schema";
import { buildDrawingPanelWiringSource } from "@/features/drawing_canvas/logic/services/drawing-panel-wiring-source";
import {
  packagePanelDrawingQualityReportSchema,
  panelWiringSourcePackageSchema
} from "@/features/drawing_panel_wiring/api/contracts";
import {
  buildPackageConnectivityGraph,
  buildPanelEngineeringSnapshotFromValidatedSource
} from "@/features/drawing_panel_wiring/api/public";
import { buildPanelReportIndex } from "@/features/drawing_panel_reports/api/public";

type TestContext = { hasLoop: boolean };

function finding(
  findingKey: string,
  title: string,
  severity: PanelAnalysisFindingDraft["severity"] = "warning"
): PanelAnalysisFindingDraft {
  return {
    findingKey,
    severity,
    evidenceLevel: "verified",
    title,
    problem: `${title} was detected.`,
    significance: "The engineering record requires review.",
    recommendedAction: "Review and correct the affected record.",
    rootCauseKey: `root:${findingKey}`,
    panelAssetIds: [],
    assetIds: [],
    affectedRecords: [],
    evidence: [],
    locations: []
  };
}

describe("Panel Analysis contracts and rule execution", () => {
  it("validates drawing focus targets and degrades stale objects to sheet focus", () => {
    const model = createDefaultDrawingModel();
    const sheet = model.sheets[0];
    const focusedModel = {
      ...model,
      sheets: [{
        ...sheet,
        placements: [{
          id: "placement_1",
          symbolId: "symbol_1",
          versionId: "version_1",
          role: "device" as const,
          tag: "LIT-101",
          x: 10,
          y: 20,
          rotation: 0,
          scale: 1
        }],
        connections: [{
          id: "connection_1",
          from: { placementId: "placement_1", anchorKey: "positive" },
          to: { placementId: "placement_1", anchorKey: "negative" }
        }]
      }]
    };

    expect(resolvePanelAnalysisNavigation({
      drawingId: "drawing_1",
      model: focusedModel,
      searchParams: {
        sheetId: sheet.id,
        objectKind: "connection",
        objectId: "connection_1"
      }
    })).toEqual({
      drawingId: "drawing_1",
      sheetId: sheet.id,
      objectKind: "connection",
      objectId: "connection_1"
    });
    expect(resolvePanelAnalysisNavigation({
      drawingId: "drawing_1",
      model: focusedModel,
      searchParams: {
        sheetId: sheet.id,
        objectKind: "placement",
        objectId: "deleted_placement"
      }
    })).toEqual({ drawingId: "drawing_1", sheetId: sheet.id });
    expect(resolvePanelAnalysisNavigation({
      drawingId: "drawing_1",
      model: focusedModel,
      searchParams: { sheetId: "deleted_sheet" }
    })).toBeUndefined();
  });

  it("filters root-cause groups without changing the saved analysis", () => {
    const first = panelAnalysisFindingSchema.parse({
      id: "rule:a",
      ruleCode: "rule",
      ruleVersion: "1",
      category: "cable_conductor",
      ...finding("a", "Cable C-101 lacks a conductor identity", "data_gap"),
      panelAssetIds: ["panel_1"],
      assetIds: ["cable_1"],
      locations: [{
        sheetId: "sheet_17",
        sheetNumber: 17,
        sheetName: "Field wiring",
        objectKind: "connection",
        objectId: "connection_1"
      }]
    });
    const second = panelAnalysisFindingSchema.parse({
      id: "rule:b",
      ruleCode: "rule",
      ruleVersion: "1",
      category: "documentation",
      ...finding("b", "Wire description references the wrong tank"),
      panelAssetIds: ["panel_2"],
      assetIds: ["wire_1"]
    });
    const findings = [first, second];
    const groups = groupPanelAnalysisFindings(findings);

    const filtered = filterPanelAnalysisFindingGroups({
      groups,
      findings,
      filters: {
        panelAssetId: "panel_1",
        severity: "data_gap",
        sheetId: "sheet_17",
        query: "C-101"
      }
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].findings.map((item) => item.id)).toEqual(["rule:a"]);
    expect(findings).toHaveLength(2);
  });

  it("summarizes grouped communication paths with every stopping terminal", () => {
    const findings = [
      ["b", "RS485 B", "TB-103 M10.1 (internal side)"],
      ["a", "RS485 A", "TB-103 M11.1 (internal side)"]
    ].map(([findingKey, role, stop]) =>
      panelAnalysisFindingSchema.parse({
        id: `instrument_loop.path_completeness:${findingKey}`,
        ruleCode: "instrument_loop.path_completeness",
        ruleVersion: "2",
        category: "instrument_loop",
        ...finding(findingKey, `LIT-101 ${role} path stops at ${stop}`, "data_gap"),
        rootCauseKey: "communication-path:lit_101",
        rootCauseTitle:
          "LIT-101 communication paths stop before reaching a controller endpoint",
        rootCauseSummaryItem: `${role} stops at ${stop}`
      })
    );

    expect(groupPanelAnalysisFindings(findings)).toEqual([
      expect.objectContaining({
        title:
          "LIT-101 communication paths stop before reaching a controller endpoint",
        summary:
          "RS485 A stops at TB-103 M11.1 (internal side); RS485 B stops at TB-103 M10.1 (internal side)."
      })
    ]);
  });

  it("builds one serializable result from one source, graph, and report index", () => {
    const model = createDefaultDrawingModel();
    const buildSource = vi.fn(buildDrawingPanelWiringSource);
    const buildSnapshot = vi.fn(
      buildPanelEngineeringSnapshotFromValidatedSource
    );
    const buildReportIndexOnce = vi.fn(buildPanelReportIndex);

    const result = buildSavedPanelAnalysis(
      {
        drawing: {
          id: "drawing_1",
          drawingKey: "drawing-1",
          title: "Test package",
          description: "Saved analysis fixture",
          project: null,
          status: "needs_review",
          model,
          createdAt: "2026-09-01T12:00:00.000Z",
          updatedAt: "2026-09-02T12:00:00.000Z"
        },
        symbols: [],
        generatedAt: new Date("2026-09-02T12:01:00.000Z")
      },
      {
        buildSource,
        buildSnapshot,
        buildReportIndex: buildReportIndexOnce
      }
    );

    expect(buildSource).toHaveBeenCalledTimes(1);
    expect(buildSnapshot).toHaveBeenCalledTimes(1);
    expect(buildReportIndexOnce).toHaveBeenCalledTimes(1);
    expect(result.sourceRevision).toMatchObject({
      drawingId: "drawing_1",
      savedAt: "2026-09-02T12:00:00.000Z"
    });
    expect(result.schedules).toEqual([]);
    expect(panelAnalysisResultSchema.parse(JSON.parse(JSON.stringify(result))))
      .toEqual(result);
  });

  it("prefers explicit terminal roles and infers controlled legacy labels", () => {
    const explicit = resolvePanelTerminalElectricalRole({
      terminal: {
        key: "4",
        label: "4-20 mA output +",
        function: "Positive signal",
        anchorKey: "4",
        electricalRole: "analog_signal_return",
      }
    });
    const positive = resolvePanelTerminalElectricalRole({
      terminal: {
        key: "4",
        label: "4",
        function: "4-20 mA output +",
        anchorKey: "4",
      }
    });
    const common = resolvePanelTerminalElectricalRole({
      terminal: {
        key: "COM1",
        label: "COM1",
        function: "Channel 1 common",
        anchorKey: "COM1",
      },
      symbolDisplayName: "4 Channel AI Module"
    });

    expect(explicit).toMatchObject({
      status: "resolved",
      role: "analog_signal_return",
      evidenceLevel: "verified",
      source: "explicit"
    });
    expect(positive).toMatchObject({
      status: "resolved",
      role: "analog_signal_positive",
      evidenceLevel: "inferred"
    });
    expect(common).toMatchObject({
      status: "resolved",
      role: "analog_signal_return",
      evidenceLevel: "inferred"
    });
  });

  it("limits compatibility conclusions to matching electrical families", () => {
    const explicitPositive = {
      status: "resolved" as const,
      role: "analog_signal_positive" as const,
      evidenceLevel: "verified" as const,
      source: "explicit" as const
    };
    const inferredReturn = {
      status: "resolved" as const,
      role: "analog_signal_return" as const,
      evidenceLevel: "inferred" as const,
      source: "inferred" as const,
      inferenceVersion: "1"
    };
    const communicationA = {
      status: "resolved" as const,
      role: "communication_a" as const,
      evidenceLevel: "verified" as const,
      source: "explicit" as const
    };

    expect(
      comparePanelTerminalElectricalRoles(explicitPositive, inferredReturn)
    ).toMatchObject({
      status: "incompatible",
      evidenceLevel: "inferred"
    });
    expect(
      comparePanelTerminalElectricalRoles(explicitPositive, communicationA)
    ).toMatchObject({ status: "not_evaluated" });
  });

  it.each([
    ["RS485 A", "communication_a"],
    ["RS485 B", "communication_b"],
    ["+24 VDC supply", "dc_positive"],
    ["0 VDC supply return", "dc_return"],
    ["Cable shield", "shield"],
    ["Protective earth", "protective_earth"]
  ] as const)("infers the controlled role for %s", (terminalFunction, role) => {
    expect(
      resolvePanelTerminalElectricalRole({
        terminal: {
          key: "T1",
          label: "T1",
          function: terminalFunction,
          anchorKey: "T1",
        }
      })
    ).toMatchObject({ status: "resolved", role, evidenceLevel: "inferred" });
  });

  it("leaves unrecognized terminal semantics unevaluated", () => {
    expect(
      resolvePanelTerminalElectricalRole({
        terminal: {
          key: "T1",
          label: "Auxiliary",
          function: "Manufacturer-defined auxiliary point",
          anchorKey: "T1",
        }
      })
    ).toMatchObject({ status: "not_evaluated" });
  });

  it("prevents inferred evidence from becoming a confirmed error", () => {
    expect(() =>
      panelAnalysisFindingSchema.parse({
        ...finding("polarity", "Probable polarity mismatch", "error"),
        id: "signal.polarity:polarity",
        ruleCode: "signal.polarity",
        ruleVersion: "1",
        category: "signal_compatibility",
        evidenceLevel: "inferred"
      })
    ).toThrow("Inferred findings must be warnings or data gaps.");
  });

  it("orders rules and findings deterministically and summarizes severities", () => {
    const rules: PanelAnalysisRule<TestContext>[] = [
      {
        code: "wire.identity",
        version: "1",
        category: "cable_conductor",
        isApplicable: () => ({ applicable: true }),
        evaluate: () => ({
          status: "finding",
          findings: [
            finding("wire-10", "Wire 10 identity is incomplete", "data_gap"),
            finding("wire-2", "Wire 2 identity is incomplete", "error")
          ]
        })
      },
      {
        code: "connectivity.graph",
        version: "1",
        category: "connectivity",
        isApplicable: () => ({ applicable: true }),
        evaluate: () => ({ status: "passed", message: "Graph is valid." })
      }
    ];

    const first = runPanelAnalysisRules({ context: { hasLoop: true }, rules });
    const second = runPanelAnalysisRules({
      context: { hasLoop: true },
      rules: [...rules].reverse()
    });

    expect(second).toEqual(first);
    expect(first.outcomes.map((outcome) => outcome.ruleCode)).toEqual([
      "connectivity.graph",
      "wire.identity"
    ]);
    expect(first.findings.map((item) => item.id)).toEqual([
      "wire.identity:wire-2",
      "wire.identity:wire-10"
    ]);
    expect(first.coverage).toEqual({
      status: "complete",
      totalRules: 2,
      applicableRules: 2,
      passedRules: 1,
      findingRules: 1,
      notApplicableRules: 0,
      unavailableRules: 0
    });
    expect(first.summary).toMatchObject({
      errors: 1,
      dataGaps: 1,
      checksNotEvaluated: 0,
      totalFindings: 2
    });
  });

  it("distinguishes inapplicable, evidence-limited, and failed checks", () => {
    const rules: PanelAnalysisRule<TestContext>[] = [
      {
        code: "loop.inapplicable",
        version: "1",
        category: "instrument_loop",
        isApplicable: ({ hasLoop }) =>
          hasLoop
            ? { applicable: true }
            : { applicable: false, reason: "No instrument loop is present." },
        evaluate: () => ({ status: "passed" })
      },
      {
        code: "signal.evidence",
        version: "1",
        category: "signal_compatibility",
        isApplicable: () => ({ applicable: true }),
        evaluate: () => ({
          status: "not_evaluated",
          reason: "Terminal electrical roles are unavailable."
        })
      },
      {
        code: "shield.failure",
        version: "1",
        category: "shield_earth",
        isApplicable: () => ({ applicable: true }),
        evaluate: () => {
          throw new Error("Synthetic rule failure");
        }
      },
      {
        code: "terminal.pass",
        version: "1",
        category: "terminal_occupancy",
        isApplicable: () => ({ applicable: true }),
        evaluate: () => ({ status: "passed" })
      }
    ];

    const result = runPanelAnalysisRules({
      context: { hasLoop: false },
      rules
    });

    expect(
      result.outcomes.map((outcome) => [
        outcome.ruleCode,
        outcome.status,
        outcome.status === "not_evaluated"
          ? outcome.notEvaluatedReason
          : undefined
      ])
    ).toEqual([
      ["loop.inapplicable", "not_evaluated", "not_applicable"],
      ["shield.failure", "not_evaluated", "execution_failed"],
      ["signal.evidence", "not_evaluated", "insufficient_evidence"],
      ["terminal.pass", "passed", undefined]
    ]);
    expect(result.coverage).toEqual({
      status: "partial",
      totalRules: 4,
      applicableRules: 3,
      passedRules: 1,
      findingRules: 0,
      notApplicableRules: 1,
      unavailableRules: 2
    });
    expect(result.summary.checksNotEvaluated).toBe(3);
  });

  it("reports not evaluated when no applicable rule completed", () => {
    const result = runPanelAnalysisRules({
      context: { hasLoop: false },
      rules: [
        {
          code: "loop.none",
          version: "1",
          category: "instrument_loop",
          isApplicable: () => ({
            applicable: false,
            reason: "No instrument loop is present."
          }),
          evaluate: () => ({ status: "passed" })
        }
      ] satisfies PanelAnalysisRule<TestContext>[]
    });

    expect(result.coverage.status).toBe("not_evaluated");
    expect(result.coverage.notApplicableRules).toBe(1);
  });

  it("adapts quality findings, detects North-shaped gaps, and groups shared causes", () => {
    const baseModel = createDefaultDrawingModel();
    const model = {
      ...baseModel,
      assets: [
        {
          id: "panel_1",
          tag: "PLC-001",
          type: "panel" as const,
          title: "PLC Panel"
        },
        {
          id: "instrument_1",
          tag: "LIT-101",
          type: "instrument" as const,
          title: "Tank 1 Level Transmitter"
        },
        {
          id: "tb_1",
          tag: "TB-103",
          type: "terminal_block" as const,
          title: "JB001 Field Termination Block (Tank 1)"
        },
        {
          id: "pdb_1",
          tag: "PDB-103",
          type: "terminal_block" as const,
          title: "+24 VDC Distribution Block"
        }
      ]
    };
    const source = panelWiringSourcePackageSchema.parse({
      assets: model.assets,
      sheets: [
        {
          id: "sheet_1",
          sheetNumber: 17,
          name: "Field Connections",
          kind: "drawing",
          occurrences: [],
          connections: []
        },
        {
          id: "sheet_2",
          sheetNumber: 28,
          name: "Detailed Wiring",
          kind: "drawing",
          panelDrawingContext: {
            kind: "detailed_panel_wiring",
            panelAssetId: "panel_1"
          },
          occurrences: [],
          connections: [
            {
              id: "route_1",
              sheetId: "sheet_2",
              from: { placementId: "pdb", anchorKey: "g" },
              to: { placementId: "tb", anchorKey: "M01.1" },
              panelConnectionId: "internal_1"
            }
          ]
        }
      ],
      panelWiring: {
        schemaVersion: 1,
        terminalMappings: [],
        bridges: [],
        bonds: [],
        internalWires: [
          {
            id: "internal_1",
            panelAssetId: "panel_1",
            wireId: "PDB-103:g(028)",
            from: { assetId: "pdb_1", terminalKey: "g", side: "internal" },
            to: { assetId: "tb_1", terminalKey: "M01.1", side: "internal" },
            attributes: {
              description: "Supply to Tank 2 field terminal block"
            },
            origin: "engineer"
          }
        ]
      }
    });
    const baseGraph = buildPackageConnectivityGraph(source);
    const graph = {
      ...baseGraph,
      panelAssetIds: new Set(["panel_1", "panel_2"]),
      panelAssetIdsByAssetId: new Map([
        ["tb_1", new Set(["panel_1", "panel_2"])]
      ]),
      terminalSidesById: new Map([
        [
          "terminal:tb_1:M01.2:external",
          {
            id: "terminal:tb_1:M01.2:external",
            terminalId: "terminal:tb_1:M01.2",
            ref: {
              assetId: "tb_1",
              terminalKey: "M01.2",
              side: "external" as const
            }
          }
        ]
      ]),
      externalTerminationsById: new Map([
        [
          "termination_1",
          {
            id: "termination_1",
            panelAssetId: "panel_1",
            status: "resolved" as const,
            mappingMode: "automatic" as const,
            sourceAssetId: "instrument_1",
            sourceAssetTag: "LIT-101",
            source: {
              sheetId: "sheet_1",
              connectionId: "field_connection_1",
              endpointRole: "from" as const,
              placementId: "lit_101",
              anchorKey: "SIGNAL+"
            },
            sourceSheet: {
              id: "sheet_1",
              number: 17,
              name: "Field Connections"
            },
            target: {
              assetId: "tb_1",
              terminalKey: "M01.2",
              side: "external" as const
            }
          }
        ],
        [
          "termination_2",
          {
            id: "termination_2",
            panelAssetId: "panel_1",
            status: "resolved" as const,
            mappingMode: "automatic" as const,
            sourceAssetId: "instrument_1",
            sourceAssetTag: "LIT-101",
            source: {
              sheetId: "sheet_1",
              connectionId: "field_connection_2",
              endpointRole: "from" as const,
              placementId: "lit_101",
              anchorKey: "SIGNAL-"
            },
            sourceSheet: {
              id: "sheet_1",
              number: 17,
              name: "Field Connections"
            },
            wireId: "W-002",
            cableTag: "C-101",
            conductorKey: "CORE02",
            target: {
              assetId: "tb_1",
              terminalKey: "M01.2",
              side: "external" as const
            }
          }
        ]
      ])
    };
    const sharedQualityFinding = {
      id: "panel_qc:graph:shared_conflict",
      code: "duplicate_terminal_conductor_occupancy",
      severity: "blocking_error" as const,
      category: "terminal" as const,
      message: "Terminal M01.2 has incompatible conductor occupants.",
      assetId: "tb_1",
      assetTag: "TB-103",
      terminal: {
        assetId: "tb_1",
        terminalKey: "M01.2",
        side: "external" as const
      },
      locations: [],
      sourceFindingIds: ["shared_conflict"]
    };
    const qualityReport = packagePanelDrawingQualityReportSchema.parse({
      reports: [
        {
          panelAssetId: "panel_1",
          panelTag: "PLC-001",
          status: "blocked",
          counts: { blockingErrors: 1, warnings: 0, information: 0 },
          findings: [
            { ...sharedQualityFinding, panelAssetId: "panel_1" }
          ],
          canApprove: false
        },
        {
          panelAssetId: "panel_2",
          panelTag: "PLC-002",
          status: "blocked",
          counts: { blockingErrors: 1, warnings: 0, information: 0 },
          findings: [
            { ...sharedQualityFinding, panelAssetId: "panel_2" }
          ],
          canApprove: false
        }
      ],
      counts: { blockingErrors: 2, warnings: 0, information: 0 },
      canApprove: false,
      firstBlockingFinding: {
        ...sharedQualityFinding,
        panelAssetId: "panel_1"
      }
    });
    const context: PanelAnalysisRuleContext = {
      model,
      source,
      graph,
      symbols: [],
      qualityReport
    };

    const result = runPanelAnalysisRules({
      context,
      rules: createPanelAnalysisRules(context)
    });
    const groups = groupPanelAnalysisFindings(result.findings);

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleCode: "panel.quality.terminal_occupancy",
          severity: "error"
        }),
        expect.objectContaining({
          ruleCode: "connection.conductor_identity",
          severity: "data_gap"
        }),
        expect.objectContaining({
          ruleCode: "terminal.external_side_multiple_landings",
          severity: "error"
        }),
        expect.objectContaining({
          ruleCode: "internal_wire.description_consistency",
          severity: "warning",
          evidenceLevel: "inferred"
        }),
        expect.objectContaining({
          ruleCode: "asset.instrument_engineering_metadata",
          severity: "data_gap"
        })
      ])
    );
    expect(
      groups.find(
        (group) =>
          group.rootCauseKey === "panel-quality-source:shared_conflict"
      )?.findingIds
    ).toHaveLength(2);
    expect(result.coverage.status).toBe("complete");
    expect(
      result.outcomes.find(
        (outcome) => outcome.ruleCode === "instrument_loop.path_completeness"
      )
    ).toMatchObject({
      status: "not_evaluated",
      notEvaluatedReason: "not_applicable"
    });
  });
});
