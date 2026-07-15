import {
  panelPatternSettingsSchema,
  panelWiringSourcePackageSchema,
  type PanelPatternSettings,
  type PanelWiringSourcePackage
} from "../../data/schema";

export type PanelPatternIdKind =
  | "terminal_jumper"
  | "bridge_bar"
  | "daisy_chain"
  | "distribution"
  | "fused_distribution"
  | "shield"
  | "protective_earth"
  | "signal_ground";

const KIND_CONFIG: Record<
  PanelPatternIdKind,
  { prefix: string; counter: keyof PanelPatternSettings["counters"] }
> = {
  terminal_jumper: { prefix: "JMP", counter: "terminalJumper" },
  bridge_bar: { prefix: "BR", counter: "bridgeBar" },
  daisy_chain: { prefix: "DC", counter: "daisyChain" },
  distribution: { prefix: "DIST", counter: "distribution" },
  fused_distribution: { prefix: "FD", counter: "fusedDistribution" },
  shield: { prefix: "SH", counter: "shield" },
  protective_earth: { prefix: "PE", counter: "protectiveEarth" },
  signal_ground: { prefix: "SG", counter: "signalGround" }
};

function defaultSettings(panelAssetId: string): PanelPatternSettings {
  return panelPatternSettingsSchema.parse({ panelAssetId, counters: {} });
}

function existingCodes(source: PanelWiringSourcePackage): Set<string> {
  return new Set(
    [
      ...(source.panelWiring?.bridges ?? []),
      ...(source.panelWiring?.bonds ?? [])
    ]
      .flatMap((record) => (record.patternCode ? [record.patternCode] : []))
      .map((code) => code.toUpperCase())
  );
}

export function getPanelPatternSettings(
  source: PanelWiringSourcePackage,
  panelAssetId: string
): PanelPatternSettings {
  return panelPatternSettingsSchema.parse(
    source.panelWiring?.patternSettings?.find(
      (settings) => settings.panelAssetId === panelAssetId
    ) ?? defaultSettings(panelAssetId)
  );
}

export function allocatePanelPatternId({
  source: inputSource,
  panelAssetId,
  kind
}: {
  source: PanelWiringSourcePackage;
  panelAssetId: string;
  kind: PanelPatternIdKind;
}): {
  id: string;
  patternCode: string;
  settings: PanelPatternSettings;
} {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  if (!source.assets.some((asset) => asset.id === panelAssetId)) {
    throw new Error("The panel asset no longer exists.");
  }
  const config = KIND_CONFIG[kind];
  const current = getPanelPatternSettings(source, panelAssetId);
  const used = existingCodes(source);
  let sequence = current.counters[config.counter];
  let patternCode = "";

  do {
    patternCode = `${config.prefix}-${String(sequence).padStart(3, "0")}`;
    sequence += 1;
  } while (used.has(patternCode.toUpperCase()));

  return {
    id: `panel_pattern:${encodeURIComponent(panelAssetId)}:${patternCode}`,
    patternCode,
    settings: panelPatternSettingsSchema.parse({
      ...current,
      counters: { ...current.counters, [config.counter]: sequence }
    })
  };
}
