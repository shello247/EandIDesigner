import type { PreviewSource } from "../data/schema";
export type { PreviewSource, PreviewEndpoint } from "../data/schema";
export type PreviewDevice = PreviewSource["devices"][number];
export type PreviewWire = PreviewSource["wires"][number];
export type PreviewPort = PreviewDevice["terminals"][number] & { x: number; y: number; side: "left" | "right" };
export type PreviewNode = { device: PreviewDevice; x: number; y: number; width: number; height: number; ports: PreviewPort[] };
export type ProjectedWire = PreviewWire & { path: string; points: Array<{ x: number; y: number }>; labelX: number; labelY: number; fromLabel: string; toLabel: string };
export type SchematicProjection = {
  source: PreviewSource; nodes: PreviewNode[]; wires: ProjectedWire[]; issues: string[];
  width: number; height: number; connectivityPreserved: boolean; terminalCount: number;
  representationRevision: "general-conventions-v1";
};
