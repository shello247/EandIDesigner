import type {
  SymbolAnchor,
  SymbolMetadata,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";
import type { TerminalBlockPlacement } from "../../data/schema";

export const GENERATED_TERMINAL_BLOCK_SYMBOL_ID =
  "__generated_terminal_block__";
export const GENERATED_TERMINAL_BLOCK_VERSION_ID =
  "generated_terminal_block_v1";
export const TERMINAL_BLOCK_TAG_PREFIX = "TB";

export const DEFAULT_TERMINAL_BLOCK_COUNT = 5;
export const DEFAULT_TERMINAL_BLOCK_START_NUMBER = 1;
export const DEFAULT_TERMINAL_BLOCK_MODULE_WIDTH = 20;
export const DEFAULT_TERMINAL_BLOCK_MODULE_HEIGHT = 178;
export const DEFAULT_TERMINAL_BLOCK_MODULE_PITCH = 20;

export type TerminalBlockTerminal = {
  key: string;
  label: string;
  number: number;
  topAnchorKey: string;
  bottomAnchorKey: string;
};

export type TerminalBlockModuleAnchorGeometry = {
  viewBox: SymbolMetadata["viewBox"];
  terminalAnchors: SymbolAnchor[];
};

function resolveModuleTerminalPoints(
  normalized: TerminalBlockPlacement,
  module: TerminalBlockModuleAnchorGeometry | undefined
): {
  top: { x: number; y: number };
  bottom: { x: number; y: number };
} {
  if (
    !module ||
    module.viewBox.width <= 0 ||
    module.viewBox.height <= 0
  ) {
    return {
      top: { x: normalized.moduleWidth / 2, y: 1 },
      bottom: {
        x: normalized.moduleWidth / 2,
        y: normalized.moduleHeight - 1
      }
    };
  }

  const ordered = module.terminalAnchors
    .filter(
      (anchor) =>
        anchor.kind === "terminal" &&
        Number.isFinite(anchor.x) &&
        Number.isFinite(anchor.y)
    )
    .map((anchor, index) => ({ anchor, index }))
    .sort(
      (left, right) =>
        left.anchor.y - right.anchor.y || left.index - right.index
    );

  const top = ordered[0]?.anchor;
  const bottom = ordered.at(-1)?.anchor;

  if (!top || !bottom || top === bottom) {
    return {
      top: { x: normalized.moduleWidth / 2, y: 1 },
      bottom: {
        x: normalized.moduleWidth / 2,
        y: normalized.moduleHeight - 1
      }
    };
  }

  const scalePoint = (point: SymbolAnchor) => ({
    x: Number(
      (
        ((point.x - module.viewBox.x) / module.viewBox.width) *
        normalized.moduleWidth
      ).toFixed(4)
    ),
    y: Number(
      (
        ((point.y - module.viewBox.y) / module.viewBox.height) *
        normalized.moduleHeight
      ).toFixed(4)
    )
  });

  return {
    top: scalePoint(top),
    bottom: scalePoint(bottom)
  };
}

export function isGeneratedTerminalBlockReference(input: {
  symbolId: string;
  versionId: string;
}): boolean {
  return (
    input.symbolId === GENERATED_TERMINAL_BLOCK_SYMBOL_ID &&
    input.versionId === GENERATED_TERMINAL_BLOCK_VERSION_ID
  );
}

export function normalizeTerminalBlockPlacement(
  config: Partial<TerminalBlockPlacement> | undefined
): TerminalBlockPlacement {
  return {
    kind: "modular_terminal_strip",
    count: Math.max(
      1,
      Math.min(80, Math.round(config?.count ?? DEFAULT_TERMINAL_BLOCK_COUNT))
    ),
    startNumber: Math.max(
      1,
      Math.min(
        9999,
        Math.round(config?.startNumber ?? DEFAULT_TERMINAL_BLOCK_START_NUMBER)
      )
    ),
    orientation: "horizontal",
    modulePitch:
      config?.modulePitch && config.modulePitch > 0
        ? config.modulePitch
        : DEFAULT_TERMINAL_BLOCK_MODULE_PITCH,
    moduleWidth:
      config?.moduleWidth && config.moduleWidth > 0
        ? config.moduleWidth
        : DEFAULT_TERMINAL_BLOCK_MODULE_WIDTH,
    moduleHeight:
      config?.moduleHeight && config.moduleHeight > 0
        ? config.moduleHeight
        : DEFAULT_TERMINAL_BLOCK_MODULE_HEIGHT,
    moduleTemplate: config?.moduleTemplate
  };
}

export function terminalBlockViewBox(config: TerminalBlockPlacement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const normalized = normalizeTerminalBlockPlacement(config);

  return {
    x: 0,
    y: 0,
    width:
      (normalized.count - 1) * normalized.modulePitch +
      normalized.moduleWidth,
    height: normalized.moduleHeight
  };
}

export function terminalBlockTerminals(
  config: TerminalBlockPlacement
): TerminalBlockTerminal[] {
  const normalized = normalizeTerminalBlockPlacement(config);

  return Array.from({ length: normalized.count }, (_, index) => {
    const number = normalized.startNumber + index;
    const key = `T${number}`;

    return {
      key,
      label: String(number),
      number,
      topAnchorKey: `${key}_TOP`,
      bottomAnchorKey: `${key}_BOTTOM`
    };
  });
}

export function terminalBlockAnchors(
  config: TerminalBlockPlacement,
  module?: TerminalBlockModuleAnchorGeometry
): SymbolAnchor[] {
  const normalized = normalizeTerminalBlockPlacement(config);
  const terminalPoints = resolveModuleTerminalPoints(normalized, module);

  return terminalBlockTerminals(normalized).flatMap((terminal, index) => {
    const moduleX = index * normalized.modulePitch;

    return [
      {
        key: terminal.topAnchorKey,
        x: moduleX + terminalPoints.top.x,
        y: terminalPoints.top.y,
        kind: "terminal" as const
      },
      {
        key: terminal.bottomAnchorKey,
        x: moduleX + terminalPoints.bottom.x,
        y: terminalPoints.bottom.y,
        kind: "terminal" as const
      }
    ];
  });
}

export function terminalBlockSymbolTerminals(
  config: TerminalBlockPlacement
): SymbolTerminal[] {
  return terminalBlockTerminals(config).flatMap((terminal) => [
    {
      key: terminal.key,
      label: terminal.label,
      function: "Feed-through terminal",
      anchorKey: terminal.topAnchorKey,
      panelSide: "internal" as const,
      requiredForWiring: false
    },
    {
      key: terminal.key,
      label: terminal.label,
      function: "Feed-through terminal",
      anchorKey: terminal.bottomAnchorKey,
      panelSide: "external" as const,
      requiredForWiring: false
    }
  ]);
}

export function terminalBlockMetadata(
  config: TerminalBlockPlacement,
  module?: TerminalBlockModuleAnchorGeometry
): SymbolMetadata {
  const normalized = normalizeTerminalBlockPlacement(config);
  const physicalWidth = normalized.moduleTemplate
    ? normalized.count * normalized.moduleTemplate.pitchMm
    : undefined;

  return {
    symbolKey: "generated_modular_terminal_block",
    displayName: "Modular Terminal Block",
    category: "terminal_block",
    layoutUsage: normalized.moduleTemplate ? "both" : undefined,
    physicalWidthMm: physicalWidth,
    physicalHeightMm: normalized.moduleTemplate?.heightMm,
    mountingType: normalized.moduleTemplate ? "din_rail" : undefined,
    panelCategory: normalized.moduleTemplate ? "termination" : undefined,
    resizable: false,
    viewBox: terminalBlockViewBox(normalized),
    anchors: terminalBlockAnchors(normalized, module),
    terminals: terminalBlockSymbolTerminals(normalized)
  };
}
