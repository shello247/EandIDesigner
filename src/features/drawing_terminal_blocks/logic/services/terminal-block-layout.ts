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
        : DEFAULT_TERMINAL_BLOCK_MODULE_HEIGHT
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
  config: TerminalBlockPlacement
): SymbolAnchor[] {
  const normalized = normalizeTerminalBlockPlacement(config);

  return terminalBlockTerminals(normalized).flatMap((terminal, index) => {
    const x = index * normalized.modulePitch + normalized.moduleWidth / 2;

    return [
      {
        key: terminal.topAnchorKey,
        x,
        y: 1,
        kind: "terminal" as const
      },
      {
        key: terminal.bottomAnchorKey,
        x,
        y: normalized.moduleHeight - 1,
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
      requiredForWiring: false
    },
    {
      key: terminal.key,
      label: terminal.label,
      function: "Feed-through terminal",
      anchorKey: terminal.bottomAnchorKey,
      requiredForWiring: false
    }
  ]);
}

export function terminalBlockMetadata(
  config: TerminalBlockPlacement
): SymbolMetadata {
  const normalized = normalizeTerminalBlockPlacement(config);

  return {
    symbolKey: "generated_modular_terminal_block",
    displayName: "Modular Terminal Block",
    category: "terminal_block",
    viewBox: terminalBlockViewBox(normalized),
    anchors: terminalBlockAnchors(normalized),
    terminals: terminalBlockSymbolTerminals(normalized)
  };
}
