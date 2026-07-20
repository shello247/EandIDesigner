import { z } from "zod";
import {
  networkDeviceTypeSchema,
  networkPortKeySchema,
  networkPortMediaSchema,
  symbolNetworkProfileSchema,
  type NetworkDeviceType,
  type NetworkPortMedia,
  type SymbolNetworkProfile
} from "../../data/schema";

export const networkManagedReviewValueSchema = z.enum([
  "unspecified",
  "managed",
  "unmanaged"
]);

export const networkPortReviewDraftSchema = z.object({
  key: z.string(),
  label: z.string(),
  anchorKey: z.string(),
  media: z.union([networkPortMediaSchema, z.literal("")]),
  speedMbps: z.string(),
  protocolHints: z.string()
});

export const networkProfileReviewDraftSchema = z.object({
  deviceType: networkDeviceTypeSchema,
  managed: networkManagedReviewValueSchema,
  ports: z.array(networkPortReviewDraftSchema)
});

export type NetworkManagedReviewValue = z.infer<
  typeof networkManagedReviewValueSchema
>;
export type NetworkPortReviewDraft = z.infer<
  typeof networkPortReviewDraftSchema
>;
export type NetworkProfileReviewDraft = z.infer<
  typeof networkProfileReviewDraftSchema
>;

function normalizeProtocolHints(value: string): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const hint of value.split(",")) {
    const trimmed = hint.trim();
    const comparisonKey = trimmed.toLocaleLowerCase();

    if (!trimmed || seen.has(comparisonKey)) {
      continue;
    }

    seen.add(comparisonKey);
    normalized.push(trimmed);
  }

  return normalized;
}

function parseSpeedMbps(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Port speed must be a positive whole number when provided.");
  }

  return parsed;
}

export function createNetworkProfileReviewDraft(
  profile?: SymbolNetworkProfile
): NetworkProfileReviewDraft {
  return {
    deviceType: profile?.deviceType ?? networkDeviceTypeSchema.options[0],
    managed:
      profile?.managed === undefined
        ? "unspecified"
        : profile.managed
          ? "managed"
          : "unmanaged",
    ports: (profile?.ports ?? []).map((port) => ({
      key: port.key,
      label: port.label,
      anchorKey: port.anchorKey,
      media: port.media,
      speedMbps: port.speedMbps === undefined ? "" : String(port.speedMbps),
      protocolHints: port.protocolHints.join(", ")
    }))
  };
}

export function buildNetworkProfileFromReviewDraft(
  input: NetworkProfileReviewDraft
): SymbolNetworkProfile {
  const draft = networkProfileReviewDraftSchema.parse(input);

  return symbolNetworkProfileSchema.parse({
    deviceType: draft.deviceType,
    managed:
      draft.managed === "unspecified" ? undefined : draft.managed === "managed",
    ports: draft.ports.map((port) => ({
      key: networkPortKeySchema.parse(port.key),
      label: port.label.trim(),
      anchorKey: networkPortKeySchema.parse(port.anchorKey),
      media: networkPortMediaSchema.parse(port.media),
      speedMbps: parseSpeedMbps(port.speedMbps),
      protocolHints: normalizeProtocolHints(port.protocolHints)
    }))
  });
}

export function createEmptyNetworkPortReviewDraft(params: {
  key: string;
  anchorKey: string;
  deviceType?: NetworkDeviceType;
  media?: NetworkPortMedia | "";
}): NetworkPortReviewDraft {
  return {
    key: params.key,
    label: params.key,
    anchorKey: params.anchorKey,
    media: params.media ?? "",
    speedMbps: "",
    protocolHints: ""
  };
}
