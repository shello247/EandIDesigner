import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SaveSymbolMetadataChangesInput,
  SymbolMetadata
} from "../data/schema";
import { mergeEditableSymbolMetadata } from "../logic/services/editable-symbol-metadata";

const database = vi.hoisted(() => {
  const versionFindUnique = vi.fn();
  const versionFindFirst = vi.fn();
  const versionUpdate = vi.fn();
  const symbolUpdate = vi.fn();
  const validationIssueDeleteMany = vi.fn();
  const validationIssueCreateMany = vi.fn();
  const transactionClient = {
    symbolVersion: { update: versionUpdate },
    symbol: { update: symbolUpdate },
    symbolValidationIssue: {
      deleteMany: validationIssueDeleteMany,
      createMany: validationIssueCreateMany
    }
  };

  return {
    versionFindUnique,
    versionFindFirst,
    versionUpdate,
    symbolUpdate,
    validationIssueDeleteMany,
    validationIssueCreateMany,
    transactionClient,
    transaction: vi.fn(),
    getSymbolDetail: vi.fn(),
    requireSymbolCategory: vi.fn(),
    validateRegisteredSymbolComponents: vi.fn()
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    symbolVersion: {
      findUnique: database.versionFindUnique,
      findFirst: database.versionFindFirst
    },
    $transaction: database.transaction
  }
}));

vi.mock("../data/queries", () => ({
  getSymbolDetail: database.getSymbolDetail,
  getSymbolVersionForExport: vi.fn()
}));

vi.mock("@/features/symbol_components/api/server", () => ({
  validateRegisteredSymbolComponents:
    database.validateRegisteredSymbolComponents
}));

vi.mock("@/features/symbol_categories/data/queries", () => ({
  findSymbolCategoryByName: vi.fn(),
  requireSymbolCategory: database.requireSymbolCategory
}));

import { saveSymbolMetadataChanges } from "../data/mutations";

const validSvg =
  '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="90" height="90"/></svg>';

const storedMetadata: SymbolMetadata = {
  symbolKey: "relay_base",
  displayName: "Relay Base",
  manufacturer: "Phoenix Contact",
  model: "BASE-1",
  category: "other",
  layoutUsage: "panel_layout",
  physicalWidthMm: 27,
  physicalHeightMm: 89,
  mountingType: "din_rail",
  panelCategory: "termination",
  resizable: false,
  panelWiring: {
    assetType: "relay",
    tagPrefix: "CR"
  },
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  anchors: [],
  terminals: [],
  componentPositions: [
    {
      key: "position_1",
      label: "Position 1",
      required: false,
      components: [
        {
          key: "relay",
          label: "Relay",
          box: {
            centerX: 14.8,
            centerY: 45.38,
            width: 23,
            height: 40,
            rotationDeg: 0
          },
          allowedSymbolIds: ["relay_24"]
        }
      ]
    }
  ]
};

function changes(
  overrides: Partial<SaveSymbolMetadataChangesInput> = {}
): SaveSymbolMetadataChangesInput {
  return {
    symbolId: "symbol_1",
    versionId: "version_1",
    categoryId: "category_termination",
    registryDetails: {
      displayName: "Relay Base Updated",
      description: "Four-pole relay base for DIN-rail mounting."
    },
    layout: {
      layoutUsage: "panel_layout",
      physicalWidthMm: 30,
      physicalHeightMm: 90,
      mountingType: "din_rail",
      panelCategory: "termination",
      resizable: false
    },
    panelWiring: {
      assetType: "relay",
      tagPrefix: "cr"
    },
    terminals: [],
    componentPositions: [
      {
        key: "position_1",
        label: "Changed label",
        required: true,
        components: [
          {
            key: "relay",
            label: "Changed component",
            box: {
              centerX: 999,
              centerY: 999,
              width: 999,
              height: 999,
              rotationDeg: 45
            },
            allowedSymbolIds: ["relay_115", "relay_230"]
          }
        ]
      }
    ],
    ...overrides
  };
}

describe("editable symbol metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.transaction.mockImplementation(
      async (
        operation: (client: typeof database.transactionClient) => unknown
      ) => operation(database.transactionClient)
    );
    database.versionFindUnique.mockResolvedValue({
      id: "version_1",
      symbolId: "symbol_1",
      versionNumber: 1,
      status: "approved",
      svg: validSvg,
      metadataJson: JSON.stringify(storedMetadata),
      symbol: {
        id: "symbol_1",
        status: "approved",
        category: "other",
        categoryId: "category_termination"
      }
    });
    database.versionFindFirst.mockResolvedValue({ id: "version_1" });
    database.validateRegisteredSymbolComponents.mockResolvedValue([]);
    database.requireSymbolCategory.mockResolvedValue({
      id: "category_termination",
      name: "Termination"
    });
    database.getSymbolDetail.mockResolvedValue({
      id: "symbol_1",
      status: "approved",
      latestVersion: { id: "version_1", versionNumber: 1 }
    });
  });

  it("applies registry details while preserving controlled identity and Figma geometry", () => {
    const merged = mergeEditableSymbolMetadata(storedMetadata, changes());

    expect(merged.componentPositions?.[0]).toMatchObject({
      key: "position_1",
      label: "Position 1",
      required: true
    });
    expect(merged.componentPositions?.[0].components[0]).toEqual({
      key: "relay",
      label: "Relay",
      box: storedMetadata.componentPositions?.[0].components[0].box,
      allowedSymbolIds: ["relay_115", "relay_230"]
    });
    expect(merged.viewBox).toEqual(storedMetadata.viewBox);
    expect(merged.anchors).toEqual(storedMetadata.anchors);
    expect(merged.symbolKey).toBe(storedMetadata.symbolKey);
    expect(merged.displayName).toBe("Relay Base Updated");
    expect(merged.description).toBe(
      "Four-pole relay base for DIN-rail mounting."
    );
    expect(merged.category).toBe(storedMetadata.category);
  });

  it("normalizes an empty description without changing the protected symbol key", () => {
    const merged = mergeEditableSymbolMetadata(
      storedMetadata,
      changes({
        registryDetails: {
          displayName: "  Relay Base Updated  ",
          description: "   "
        }
      })
    );

    expect(merged.displayName).toBe("Relay Base Updated");
    expect(merged.description).toBeUndefined();
    expect(merged.symbolKey).toBe("relay_base");
  });

  it("rejects attempts to add or remove Figma-authored positions", () => {
    expect(() =>
      mergeEditableSymbolMetadata(storedMetadata, {
        ...changes(),
        componentPositions: []
      })
    ).toThrow(/controlled by the imported Figma artwork/i);
  });

  it("updates an approved version in place and preserves approval", async () => {
    const detail = await saveSymbolMetadataChanges(changes());

    expect(detail).toMatchObject({
      id: "symbol_1",
      status: "approved",
      latestVersion: { id: "version_1", versionNumber: 1 }
    });
    expect(database.versionUpdate).toHaveBeenCalledTimes(1);
    const versionUpdate = database.versionUpdate.mock.calls[0][0];
    expect(versionUpdate.where).toEqual({ id: "version_1" });
    expect(versionUpdate.data.status).toBe("approved");
    expect(versionUpdate.data).not.toHaveProperty("svg");
    expect(JSON.parse(versionUpdate.data.metadataJson)).toMatchObject({
      displayName: "Relay Base Updated",
      description: "Four-pole relay base for DIN-rail mounting.",
      physicalWidthMm: 30,
      physicalHeightMm: 90,
      panelWiring: {
        assetType: "relay",
        tagPrefix: "CR"
      }
    });
    expect(database.symbolUpdate).toHaveBeenCalledWith({
      where: { id: "symbol_1" },
      data: {
        status: "approved",
        displayName: "Relay Base Updated",
        categoryId: "category_termination"
      }
    });
  });

  it("refreshes warning evidence without deactivating an approved symbol", async () => {
    database.validateRegisteredSymbolComponents.mockResolvedValue([
      {
        severity: "warning",
        code: "COMPONENT_REVIEW",
        message: "Review this component assignment.",
        path: "componentPositions.0"
      }
    ]);

    await saveSymbolMetadataChanges(changes());

    expect(database.validationIssueDeleteMany).toHaveBeenCalledWith({
      where: {
        symbolId: "symbol_1",
        versionId: "version_1"
      }
    });
    expect(database.validationIssueCreateMany).toHaveBeenCalledWith({
      data: [
        {
          symbolId: "symbol_1",
          versionId: "version_1",
          severity: "warning",
          code: "COMPONENT_REVIEW",
          message: "Review this component assignment.",
          path: "componentPositions.0"
        }
      ]
    });
    expect(database.versionUpdate.mock.calls[0][0].data.status).toBe(
      "approved"
    );
  });

  it("moves draft metadata changes into needs review", async () => {
    database.versionFindUnique.mockResolvedValue({
      id: "version_1",
      symbolId: "symbol_1",
      versionNumber: 1,
      status: "draft",
      svg: validSvg,
      metadataJson: JSON.stringify(storedMetadata),
      symbol: {
        id: "symbol_1",
        status: "draft",
        category: "other"
      }
    });

    await saveSymbolMetadataChanges(changes());

    expect(database.versionUpdate.mock.calls[0][0].data.status).toBe(
      "needs_review"
    );
    expect(database.symbolUpdate).toHaveBeenCalledWith({
      where: { id: "symbol_1" },
      data: {
        status: "needs_review",
        displayName: "Relay Base Updated",
        categoryId: "category_termination"
      }
    });
  });

  it("rejects edits to archived and historical versions", async () => {
    database.versionFindUnique.mockResolvedValueOnce({
      ...(await database.versionFindUnique()),
      symbol: {
        id: "symbol_1",
        status: "archived",
        category: "other"
      }
    });

    await expect(saveSymbolMetadataChanges(changes())).rejects.toThrow(
      /archived/i
    );

    database.versionFindUnique.mockResolvedValue({
      id: "version_1",
      symbolId: "symbol_1",
      versionNumber: 1,
      status: "approved",
      svg: validSvg,
      metadataJson: JSON.stringify(storedMetadata),
      symbol: {
        id: "symbol_1",
        status: "approved",
        category: "other"
      }
    });
    database.versionFindFirst.mockResolvedValue({ id: "version_2" });

    await expect(saveSymbolMetadataChanges(changes())).rejects.toThrow(
      /historical/i
    );
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("rejects blocking edits without writing an approved symbol", async () => {
    const networkMetadata: SymbolMetadata = {
      ...storedMetadata,
      category: "network_device",
      componentPositions: undefined,
      networkProfile: {
        deviceType: "switch",
        ports: [
          {
            key: "ETH1",
            label: "Ethernet 1",
            anchorKey: "ETH1",
            media: "copper",
            protocolHints: []
          }
        ]
      },
      anchors: [
        {
          key: "ETH1",
          x: 50,
          y: 50,
          kind: "network_port"
        }
      ]
    };
    database.versionFindUnique.mockResolvedValue({
      id: "version_1",
      symbolId: "symbol_1",
      versionNumber: 1,
      status: "approved",
      svg: validSvg,
      metadataJson: JSON.stringify(networkMetadata),
      symbol: {
        id: "symbol_1",
        status: "approved",
        category: "network_device"
      }
    });

    await expect(
      saveSymbolMetadataChanges(
        changes({
          componentPositions: undefined,
          networkProfile: {
            deviceType: "switch",
            ports: []
          },
          networkIdentity: {
            manufacturer: "Industrial Networks",
            model: "SW-1"
          }
        })
      )
    ).rejects.toThrow(/at least one valid network port/i);

    expect(database.transaction).not.toHaveBeenCalled();
    expect(database.versionUpdate).not.toHaveBeenCalled();
  });
});
