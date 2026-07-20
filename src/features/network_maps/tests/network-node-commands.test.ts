import { describe, expect, it } from "vitest";
import {
  addNetworkNodeCommand,
  allocateNetworkNodeTag,
  deleteNetworkNodeCommand,
  moveNetworkNodesCommand,
  updateNetworkNodeCommand
} from "../logic/commands/network-node-commands";
import { createDefaultNetworkMapModel } from "../data/schema";

const switchSource = {
  symbolId: "symbol_switch",
  versionId: "version_switch",
  deviceType: "switch" as const,
  viewBox: { x: 0, y: 0, width: 180, height: 82 }
};

describe("network node commands", () => {
  it("adds a centered node with immutable identity and a unique default tag", () => {
    const model = createDefaultNetworkMapModel();
    const first = addNetworkNodeCommand(model, {
      sheetId: "sheet_1",
      nodeId: "node_1",
      source: switchSource,
      point: { x: 210, y: 140 }
    });
    const second = addNetworkNodeCommand(first.model, {
      sheetId: "sheet_1",
      nodeId: "node_2",
      source: switchSource,
      point: { x: 280, y: 140 }
    });

    expect(first.node).toMatchObject({
      symbolId: "symbol_switch",
      versionId: "version_switch",
      tag: "SW-001",
      x: 180,
      y: 130,
      scale: 0.35
    });
    expect(second.model.sheets[0].nodes[1].tag).toBe("SW-002");
    expect(allocateNetworkNodeTag(second.model, "server")).toBe("SRV-001");
  });

  it("updates only editable properties and blocks duplicate tags", () => {
    const first = addNetworkNodeCommand(createDefaultNetworkMapModel(), {
      sheetId: "sheet_1",
      nodeId: "node_1",
      source: switchSource,
      point: { x: 100, y: 100 }
    });
    const second = addNetworkNodeCommand(first.model, {
      sheetId: "sheet_1",
      nodeId: "node_2",
      source: switchSource,
      point: { x: 200, y: 100 }
    });
    const updated = updateNetworkNodeCommand(second.model, {
      sheetId: "sheet_1",
      nodeId: "node_1",
      updates: {
        label: "Core switch",
        ipAddress: "10.20.0.1",
        vlanId: 20,
        rotation: -90,
        scale: 0.5
      }
    });
    const node = updated.sheets[0].nodes[0];

    expect(node).toMatchObject({
      symbolId: "symbol_switch",
      versionId: "version_switch",
      label: "Core switch",
      ipAddress: "10.20.0.1",
      vlanId: 20,
      rotation: 270,
      scale: 0.5
    });
    expect(() =>
      updateNetworkNodeCommand(updated, {
        sheetId: "sheet_1",
        nodeId: "node_2",
        updates: { tag: "sw-001" }
      })
    ).toThrow(/already used/i);
  });

  it("moves selected nodes once with grid snapping and sheet clamping", () => {
    const added = addNetworkNodeCommand(createDefaultNetworkMapModel(), {
      sheetId: "sheet_1",
      nodeId: "node_1",
      source: switchSource,
      point: { x: 100, y: 100 }
    });
    const moved = moveNetworkNodesCommand(added.model, {
      sheetId: "sheet_1",
      nodeIds: ["node_1"],
      delta: { x: 27, y: 14 },
      nodeSizes: { node_1: { width: 63, height: 28.7 } }
    });

    expect(moved.sheets[0].nodes[0]).toMatchObject({ x: 100, y: 100 });
  });

  it("deletes the node and cascades every referencing link", () => {
    const first = addNetworkNodeCommand(createDefaultNetworkMapModel(), {
      sheetId: "sheet_1",
      nodeId: "node_1",
      source: switchSource,
      point: { x: 100, y: 100 }
    });
    const second = addNetworkNodeCommand(first.model, {
      sheetId: "sheet_1",
      nodeId: "node_2",
      source: switchSource,
      point: { x: 200, y: 100 }
    });
    second.model.sheets[0].links.push({
      id: "link_1",
      from: { nodeId: "node_1", portKey: "ETH1" },
      to: { nodeId: "node_2", portKey: "ETH1" },
      media: "copper"
    });

    const deleted = deleteNetworkNodeCommand(second.model, {
      sheetId: "sheet_1",
      nodeId: "node_1"
    });

    expect(deleted.sheets[0].nodes.map((node) => node.id)).toEqual(["node_2"]);
    expect(deleted.sheets[0].links).toEqual([]);
  });
});
