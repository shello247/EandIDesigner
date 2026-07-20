import {
  DEFAULT_NETWORK_NODE_SCALE,
  networkMapModelSchema,
  networkNodeEditableUpdatesSchema,
  type NetworkMapDeviceType,
  type NetworkMapModel,
  type NetworkMapNode,
  type NetworkNodeEditableUpdates
} from "../../data/schema";
import {
  constrainNetworkNodeOrigin,
  getNetworkNodeSize,
  networkNodeOriginFromCenter,
  normalizeNetworkNodeRotation,
  type NetworkNodeSize,
  type NetworkPoint
} from "../services/network-node-geometry";

export type NetworkNodePlacementSource = {
  symbolId: string;
  versionId: string;
  deviceType: NetworkMapDeviceType;
  viewBox: { x: number; y: number; width: number; height: number };
};

const TAG_PREFIXES: Record<NetworkMapDeviceType, string> = {
  switch: "SW",
  router_firewall: "FW",
  controller_plc: "PLC",
  hmi_workstation: "HMI",
  server: "SRV",
  wireless_radio: "RAD",
  field_device: "FD",
  patch_point: "PP",
  media_converter: "MC"
};

function parseModel(model: NetworkMapModel): NetworkMapModel {
  return networkMapModelSchema.parse(model);
}

function normalizedOptional(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

export function allocateNetworkNodeTag(
  model: NetworkMapModel,
  deviceType: NetworkMapDeviceType
): string {
  const existingTags = new Set(
    model.sheets.flatMap((sheet) =>
      sheet.nodes.map((node) => node.tag.trim().toUpperCase())
    )
  );
  const prefix = TAG_PREFIXES[deviceType];

  for (let index = 1; index < 10000; index += 1) {
    const candidate = `${prefix}-${String(index).padStart(3, "0")}`;

    if (!existingTags.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No available ${prefix} network node tags remain.`);
}

export function addNetworkNodeCommand(
  model: NetworkMapModel,
  input: {
    sheetId: string;
    nodeId: string;
    source: NetworkNodePlacementSource;
    point: NetworkPoint;
    scale?: number;
  }
): { model: NetworkMapModel; node: NetworkMapNode } {
  const sheet = model.sheets.find((candidate) => candidate.id === input.sheetId);

  if (!sheet) {
    throw new Error("The active network sheet was not found.");
  }

  const scale = input.scale ?? DEFAULT_NETWORK_NODE_SCALE;
  const size = {
    width: input.source.viewBox.width * scale,
    height: input.source.viewBox.height * scale
  };
  const origin = networkNodeOriginFromCenter({
    center: input.point,
    size,
    page: sheet.page
  });
  const node: NetworkMapNode = {
    id: input.nodeId,
    symbolId: input.source.symbolId,
    versionId: input.source.versionId,
    tag: allocateNetworkNodeTag(model, input.source.deviceType),
    deviceType: input.source.deviceType,
    x: origin.x,
    y: origin.y,
    rotation: 0,
    scale
  };
  const nextModel = parseModel({
    ...model,
    sheets: model.sheets.map((candidate) =>
      candidate.id === sheet.id
        ? { ...candidate, nodes: [...candidate.nodes, node] }
        : candidate
    )
  });

  return { model: nextModel, node };
}

export function updateNetworkNodeCommand(
  model: NetworkMapModel,
  input: {
    sheetId: string;
    nodeId: string;
    updates: NetworkNodeEditableUpdates;
  }
): NetworkMapModel {
  const updates = networkNodeEditableUpdatesSchema.parse(input.updates);
  const normalizedUpdates: NetworkNodeEditableUpdates = {
    ...updates,
    ...(updates.tag === undefined
      ? {}
      : { tag: updates.tag.trim().toUpperCase() }),
    ...(Object.prototype.hasOwnProperty.call(updates, "label")
      ? { label: normalizedOptional(updates.label) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, "ipAddress")
      ? { ipAddress: normalizedOptional(updates.ipAddress) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(updates, "zoneId")
      ? { zoneId: normalizedOptional(updates.zoneId) }
      : {}),
    ...(updates.rotation === undefined
      ? {}
      : { rotation: normalizeNetworkNodeRotation(updates.rotation) })
  };
  let found = false;
  const nextModel = {
    ...model,
    sheets: model.sheets.map((sheet) => {
      if (sheet.id !== input.sheetId) {
        return sheet;
      }

      return {
        ...sheet,
        nodes: sheet.nodes.map((node) => {
          if (node.id !== input.nodeId) {
            return node;
          }

          found = true;
          return { ...node, ...normalizedUpdates };
        })
      };
    })
  };

  if (!found) {
    throw new Error("The selected network node was not found.");
  }

  return parseModel(nextModel);
}

export function moveNetworkNodesCommand(
  model: NetworkMapModel,
  input: {
    sheetId: string;
    nodeIds: readonly string[];
    delta: NetworkPoint;
    nodeSizes: Readonly<Record<string, NetworkNodeSize>>;
  }
): NetworkMapModel {
  const selectedIds = new Set(input.nodeIds);
  let foundCount = 0;
  const nextModel = {
    ...model,
    sheets: model.sheets.map((sheet) => {
      if (sheet.id !== input.sheetId) {
        return sheet;
      }

      return {
        ...sheet,
        nodes: sheet.nodes.map((node) => {
          if (!selectedIds.has(node.id)) {
            return node;
          }

          foundCount += 1;
          const size = input.nodeSizes[node.id] ?? getNetworkNodeSize(node);
          const origin = constrainNetworkNodeOrigin({
            point: {
              x: node.x + input.delta.x,
              y: node.y + input.delta.y
            },
            size,
            page: sheet.page
          });

          return { ...node, ...origin };
        })
      };
    })
  };

  if (foundCount !== selectedIds.size) {
    throw new Error("One or more selected network nodes were not found.");
  }

  return parseModel(nextModel);
}

export function deleteNetworkNodeCommand(
  model: NetworkMapModel,
  input: { sheetId: string; nodeId: string }
): NetworkMapModel {
  let found = false;
  const nextModel = {
    ...model,
    sheets: model.sheets.map((sheet) => {
      if (sheet.id !== input.sheetId) {
        return sheet;
      }

      found = sheet.nodes.some((node) => node.id === input.nodeId);

      return {
        ...sheet,
        nodes: sheet.nodes.filter((node) => node.id !== input.nodeId),
        links: sheet.links.filter(
          (link) =>
            link.from.nodeId !== input.nodeId && link.to.nodeId !== input.nodeId
        )
      };
    })
  };

  if (!found) {
    throw new Error("The selected network node was not found.");
  }

  return parseModel(nextModel);
}
