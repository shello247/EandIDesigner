import type {
  SymbolTerminal,
  SymbolTerminalElectricalRole
} from "@/features/symbol_registry/api/public";
import type { PanelAnalysisEvidenceLevel } from "../../data/schema";

export const PANEL_ANALYSIS_SIGNAL_INFERENCE_VERSION = "1";

export type PanelTerminalRoleResolution =
  | {
      status: "resolved";
      role: SymbolTerminalElectricalRole;
      evidenceLevel: PanelAnalysisEvidenceLevel;
      source: "explicit" | "inferred";
      inferenceVersion?: string;
    }
  | {
      status: "not_evaluated";
      reason: string;
    };

export type PanelTerminalRoleCompatibility =
  | {
      status: "compatible" | "incompatible";
      evidenceLevel: PanelAnalysisEvidenceLevel;
      reason: string;
    }
  | {
      status: "not_evaluated";
      reason: string;
    };

function normalized(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function inferred(
  role: SymbolTerminalElectricalRole
): PanelTerminalRoleResolution {
  return {
    status: "resolved",
    role,
    evidenceLevel: "inferred",
    source: "inferred",
    inferenceVersion: PANEL_ANALYSIS_SIGNAL_INFERENCE_VERSION
  };
}

export function resolvePanelTerminalElectricalRole({
  terminal,
  symbolDisplayName
}: {
  terminal: SymbolTerminal;
  symbolDisplayName?: string;
}): PanelTerminalRoleResolution {
  if (terminal.electricalRole) {
    return {
      status: "resolved",
      role: terminal.electricalRole,
      evidenceLevel: "verified",
      source: "explicit"
    };
  }

  const key = normalized(terminal.key);
  const label = normalized(terminal.label);
  const terminalFunction = normalized(terminal.function);
  const evidence = `${key} ${label} ${terminalFunction}`;
  const symbolName = normalized(symbolDisplayName);

  if (/\b(PROTECTIVE EARTH|EARTH|PE)\b/u.test(evidence)) {
    return inferred("protective_earth");
  }
  if (/\b(SHIELD|SCREEN|DRAIN)\b/u.test(evidence)) {
    return inferred("shield");
  }
  if (/\b(RS\s*-?\s*485|MODBUS|COMMUNICATION)\b.*\bA\b/u.test(evidence)) {
    return inferred("communication_a");
  }
  if (/\b(RS\s*-?\s*485|MODBUS|COMMUNICATION)\b.*\bB\b/u.test(evidence)) {
    return inferred("communication_b");
  }
  if (
    /\b4\s*-\s*20\s*MA\b.*\b(OUTPUT|SIGNAL)\b/u.test(evidence) &&
    /\+|\bPOSITIVE\b/u.test(evidence)
  ) {
    return inferred("analog_signal_positive");
  }
  if (
    /\b4\s*-\s*20\s*MA\b.*\b(OUTPUT|SIGNAL)\b/u.test(evidence) &&
    /\b(NEGATIVE|RETURN|COMMON)\b|\s-\s*$/u.test(evidence)
  ) {
    return inferred("analog_signal_return");
  }
  if (/^CI[-_]?\d+$/u.test(key) || /\bCURRENT INPUT\b/u.test(evidence)) {
    return inferred("analog_signal_positive");
  }
  if (
    (/\b(ANALOG INPUT|AI MODULE|4 CHANNEL AI)\b/u.test(symbolName) ||
      /\bCHANNEL\s+\d+\s+COMMON\b/u.test(terminalFunction)) &&
    (/^COM\d+$/u.test(key) || /\bCOMMON\b/u.test(terminalFunction))
  ) {
    return inferred("analog_signal_return");
  }
  if (/(\+\s*24\s*V|24\s*V\s*DC\s*POSITIVE|DC24_POS|V\+)/u.test(evidence)) {
    return inferred("dc_positive");
  }
  if (/\b(0\s*V(?:\s*DC)?|24\s*V\s*DC\s*(NEGATIVE|RETURN)|DC24_NEG|DC RETURN)\b/u.test(evidence)) {
    return inferred("dc_return");
  }
  if (/\b(NEUTRAL|AC NEUTRAL)\b/u.test(evidence) || key === "N") {
    return inferred("power_neutral");
  }
  if (/\b(AC LINE|LINE SUPPLY|LIVE|PHASE)\b/u.test(evidence) || /^L\d*$/u.test(key)) {
    return inferred("power_line");
  }
  if (/\bDIGITAL\s+(INPUT|OUTPUT|SIGNAL)\b/u.test(evidence)) {
    return inferred("digital_signal");
  }

  return {
    status: "not_evaluated",
    reason: "No explicit or conservatively inferred electrical role is available."
  };
}

type RoleFamily = "ac" | "dc" | "analog" | "communication";

function roleFamily(role: SymbolTerminalElectricalRole): RoleFamily | undefined {
  if (role === "power_line" || role === "power_neutral") return "ac";
  if (role === "dc_positive" || role === "dc_return") return "dc";
  if (role === "analog_signal_positive" || role === "analog_signal_return") {
    return "analog";
  }
  if (role === "communication_a" || role === "communication_b") {
    return "communication";
  }
  return undefined;
}

export function comparePanelTerminalElectricalRoles(
  first: Extract<PanelTerminalRoleResolution, { status: "resolved" }>,
  second: Extract<PanelTerminalRoleResolution, { status: "resolved" }>
): PanelTerminalRoleCompatibility {
  const firstFamily = roleFamily(first.role);
  const secondFamily = roleFamily(second.role);

  if (!firstFamily || !secondFamily || firstFamily !== secondFamily) {
    return {
      status: "not_evaluated",
      reason: "The terminal roles do not belong to one comparable polarity family."
    };
  }

  const evidenceLevel =
    first.evidenceLevel === "verified" && second.evidenceLevel === "verified"
      ? "verified"
      : "inferred";

  return first.role === second.role
    ? {
        status: "compatible",
        evidenceLevel,
        reason: `Both terminals resolve to ${first.role}.`
      }
    : {
        status: "incompatible",
        evidenceLevel,
        reason: `${first.role} is connected to ${second.role}.`
      };
}
