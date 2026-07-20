import { z } from "zod";

export const DEFAULT_NETWORK_NODE_SCALE = 0.35;
export const MIN_NETWORK_NODE_SCALE = 0.1;
export const MAX_NETWORK_NODE_SCALE = 4;

export const networkMapStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "archived"
]);

export const networkMapDeviceTypeSchema = z.enum([
  "switch",
  "router_firewall",
  "controller_plc",
  "hmi_workstation",
  "server",
  "wireless_radio",
  "field_device",
  "patch_point",
  "media_converter"
]);

export const networkMapLinkMediaSchema = z.enum([
  "copper",
  "fiber",
  "wireless",
  "serial",
  "virtual",
  "other"
]);

export const networkMapTitleBlockSchema = z.object({
  client: z.string().trim().max(160).optional(),
  project: z.string().trim().max(200).optional(),
  mapNumber: z.string().trim().max(120).optional(),
  revision: z.string().trim().max(40).optional(),
  preparedBy: z.string().trim().max(120).optional(),
  checkedBy: z.string().trim().max(120).optional(),
  date: z.string().trim().max(40).optional()
});

export const networkMapSheetPageSchema = z.object({
  size: z.literal("A3_LANDSCAPE"),
  width: z.number().positive(),
  height: z.number().positive(),
  gridSize: z.number().positive()
});

export const networkMapNodeSchema = z.object({
  id: z.string().trim().min(1),
  symbolId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  tag: z.string().trim().min(1).max(120),
  label: z.string().trim().max(180).optional(),
  deviceType: networkMapDeviceTypeSchema,
  ipAddress: z.string().trim().max(80).optional(),
  vlanId: z.number().int().min(1).max(4094).optional(),
  zoneId: z.string().trim().min(1).optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite(),
  scale: z
    .number()
    .min(MIN_NETWORK_NODE_SCALE)
    .max(MAX_NETWORK_NODE_SCALE)
});

export const networkNodeEditableUpdatesSchema = networkMapNodeSchema
  .pick({
    tag: true,
    label: true,
    ipAddress: true,
    vlanId: true,
    zoneId: true,
    rotation: true,
    scale: true
  })
  .partial()
  .refine((updates) => Object.keys(updates).length > 0, {
    message: "At least one network node property must be updated."
  });

export const networkMapEndpointSchema = z.object({
  nodeId: z.string().trim().min(1),
  portKey: z.string().trim().min(1)
});

export const networkMapRoutePointSchema = z.object({
  id: z.string().trim().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  kind: z.enum(["endpoint", "elbow", "control"])
});

export const networkMapLinkRouteSchema = z.object({
  mode: z.enum(["manual", "auto"]),
  style: z.literal("orthogonal"),
  points: z.array(networkMapRoutePointSchema).min(2),
  labelPosition: z
    .object({
      x: z.number().finite(),
      y: z.number().finite()
    })
    .optional()
});

export const networkMapLinkSchema = z.object({
  id: z.string().trim().min(1),
  from: networkMapEndpointSchema,
  to: networkMapEndpointSchema,
  label: z.string().trim().max(160).optional(),
  media: networkMapLinkMediaSchema,
  vlanId: z.number().int().min(1).max(4094).optional(),
  networkId: z.string().trim().max(120).optional(),
  protocol: z.string().trim().max(120).optional(),
  route: networkMapLinkRouteSchema.optional()
});

export const networkMapZoneSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  color: z.string().trim().max(40).optional()
});

export const networkMapAnnotationSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().max(120).optional(),
  text: z.string().trim().max(400),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  kind: z.enum(["note", "callout", "title"])
});

export const networkMapSheetSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
  page: networkMapSheetPageSchema,
  zones: z.array(networkMapZoneSchema),
  nodes: z.array(networkMapNodeSchema),
  links: z.array(networkMapLinkSchema),
  annotations: z.array(networkMapAnnotationSchema)
});

export const networkMapModelSchema = z
  .object({
    version: z.literal(1),
    titleBlock: networkMapTitleBlockSchema,
    sheets: z.array(networkMapSheetSchema).min(1)
  })
  .superRefine((model, context) => {
    const seenIpAddresses = new Map<string, string>();
    const seenNodeIds = new Map<string, string>();
    const seenNodeTags = new Map<string, string>();

    model.sheets.forEach((sheet, sheetIndex) => {
      const nodeIds = new Set(sheet.nodes.map((node) => node.id));
      const zoneIds = new Set(sheet.zones.map((zone) => zone.id));

      sheet.nodes.forEach((node, nodeIndex) => {
        const ipAddress = node.ipAddress?.trim().toLowerCase();
        const normalizedTag = node.tag.trim().toUpperCase();
        const existingNodeSheet = seenNodeIds.get(node.id);
        const existingTag = seenNodeTags.get(normalizedTag);

        if (existingNodeSheet) {
          context.addIssue({
            code: "custom",
            message: `Network node ID "${node.id}" is already used on ${existingNodeSheet}.`,
            path: ["sheets", sheetIndex, "nodes", nodeIndex, "id"]
          });
        } else {
          seenNodeIds.set(node.id, sheet.name);
        }

        if (existingTag) {
          context.addIssue({
            code: "custom",
            message: `Network node tag "${node.tag}" is already used by ${existingTag}.`,
            path: ["sheets", sheetIndex, "nodes", nodeIndex, "tag"]
          });
        } else {
          seenNodeTags.set(normalizedTag, node.tag);
        }

        if (node.zoneId && !zoneIds.has(node.zoneId)) {
          context.addIssue({
            code: "custom",
            message: `Network node "${node.tag}" references a missing zone.`,
            path: ["sheets", sheetIndex, "nodes", nodeIndex, "zoneId"]
          });
        }

        if (!ipAddress) {
          return;
        }

        const existingIpTag = seenIpAddresses.get(ipAddress);

        if (existingIpTag) {
          context.addIssue({
            code: "custom",
            message: `IP address "${node.ipAddress}" is already used by ${existingIpTag}.`,
            path: ["sheets", sheetIndex, "nodes", nodeIndex, "ipAddress"]
          });
          return;
        }

        seenIpAddresses.set(ipAddress, node.tag);
      });

      sheet.links.forEach((link, linkIndex) => {
        if (!nodeIds.has(link.from.nodeId)) {
          context.addIssue({
            code: "custom",
            message: "Link source node is missing.",
            path: ["sheets", sheetIndex, "links", linkIndex, "from", "nodeId"]
          });
        }

        if (!nodeIds.has(link.to.nodeId)) {
          context.addIssue({
            code: "custom",
            message: "Link destination node is missing.",
            path: ["sheets", sheetIndex, "links", linkIndex, "to", "nodeId"]
          });
        }
      });
    });
  });

export const createNetworkMapInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  mapKey: z.string().trim().min(1).max(120).optional()
});

export const saveNetworkMapInputSchema = z.object({
  networkMapId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  model: networkMapModelSchema
});

export type NetworkMapStatus = z.infer<typeof networkMapStatusSchema>;
export type NetworkMapDeviceType = z.infer<typeof networkMapDeviceTypeSchema>;
export type NetworkMapLinkMedia = z.infer<typeof networkMapLinkMediaSchema>;
export type NetworkMapTitleBlock = z.infer<typeof networkMapTitleBlockSchema>;
export type NetworkMapSheetPage = z.infer<typeof networkMapSheetPageSchema>;
export type NetworkMapNode = z.infer<typeof networkMapNodeSchema>;
export type NetworkNodeEditableUpdates = z.infer<
  typeof networkNodeEditableUpdatesSchema
>;
export type NetworkMapEndpoint = z.infer<typeof networkMapEndpointSchema>;
export type NetworkMapRoutePoint = z.infer<typeof networkMapRoutePointSchema>;
export type NetworkMapLinkRoute = z.infer<typeof networkMapLinkRouteSchema>;
export type NetworkMapLink = z.infer<typeof networkMapLinkSchema>;
export type NetworkMapZone = z.infer<typeof networkMapZoneSchema>;
export type NetworkMapAnnotation = z.infer<typeof networkMapAnnotationSchema>;
export type NetworkMapSheet = z.infer<typeof networkMapSheetSchema>;
export type NetworkMapModel = z.infer<typeof networkMapModelSchema>;
export type CreateNetworkMapInput = z.infer<typeof createNetworkMapInputSchema>;
export type SaveNetworkMapInput = z.infer<typeof saveNetworkMapInputSchema>;

export function createDefaultNetworkMapSheet({
  id = "sheet_1",
  name = "Network Topology"
}: {
  id?: string;
  name?: string;
} = {}): NetworkMapSheet {
  return {
    id,
    name,
    page: {
      size: "A3_LANDSCAPE",
      width: 420,
      height: 297,
      gridSize: 10
    },
    zones: [],
    nodes: [],
    links: [],
    annotations: []
  };
}

export function createDefaultNetworkMapModel(): NetworkMapModel {
  return {
    version: 1,
    titleBlock: {
      revision: "A",
      date: new Date().toISOString().slice(0, 10)
    },
    sheets: [createDefaultNetworkMapSheet()]
  };
}

export function parseNetworkMapModelJson(modelJson: string): NetworkMapModel {
  return networkMapModelSchema.parse(JSON.parse(modelJson));
}

export function stringifyNetworkMapModel(model: NetworkMapModel): string {
  return JSON.stringify(networkMapModelSchema.parse(model), null, 2);
}
