import {
  networkPortKeySchema,
  symbolNetworkProfileSchema,
  type SymbolAnchor,
  type SymbolNetworkProfile
} from "@/features/symbol_registry/data/schema";
import {
  svgImportNetworkProfileDraftSchema,
  type SvgImportNetworkPortDraft,
  type SvgImportNetworkProfileDraft
} from "../../data/schema";

export function createNetworkPortDrafts(
  anchors: SymbolAnchor[]
): SvgImportNetworkPortDraft[] {
  return anchors.flatMap((anchor) =>
    anchor.kind === "network_port"
      ? [
          {
            key: networkPortKeySchema.parse(anchor.key),
            label: networkPortKeySchema.parse(anchor.key),
            anchorKey: networkPortKeySchema.parse(anchor.key),
            media: "" as const,
            speedMbps: "",
            protocolHints: ""
          }
        ]
      : []
  );
}

export function parseNetworkPortSpeed(
  value: string,
  portKey: string
): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const speedMbps = Number(normalized);
  if (!Number.isInteger(speedMbps) || speedMbps <= 0) {
    throw new Error(
      `Speed for network port "${portKey}" must be a positive whole number.`
    );
  }

  return speedMbps;
}

export function normalizeProtocolHints(value: string): string[] {
  const seen = new Set<string>();
  const hints: string[] = [];

  for (const item of value.split(",")) {
    const hint = item.trim();
    const comparisonKey = hint.toLowerCase();

    if (!hint || seen.has(comparisonKey)) {
      continue;
    }

    seen.add(comparisonKey);
    hints.push(hint);
  }

  return hints;
}

export function buildNetworkProfileFromDraft(
  input: SvgImportNetworkProfileDraft
): SymbolNetworkProfile {
  const parsed = svgImportNetworkProfileDraftSchema.parse(input);

  if (!parsed.deviceType) {
    throw new Error("Select a network device type.");
  }

  return symbolNetworkProfileSchema.parse({
    deviceType: parsed.deviceType,
    managed: parsed.managed,
    ports: parsed.ports.map((port) => {
      const key = networkPortKeySchema.parse(port.key);

      if (!port.media) {
        throw new Error(`Select media for network port "${key}".`);
      }

      return {
        key,
        label: port.label.trim(),
        anchorKey: networkPortKeySchema.parse(port.anchorKey),
        media: port.media,
        speedMbps: parseNetworkPortSpeed(port.speedMbps, key),
        protocolHints: normalizeProtocolHints(port.protocolHints)
      };
    })
  });
}

export function isNetworkProfileDraftComplete(
  input: SvgImportNetworkProfileDraft
): boolean {
  try {
    buildNetworkProfileFromDraft(input);
    return true;
  } catch {
    return false;
  }
}
