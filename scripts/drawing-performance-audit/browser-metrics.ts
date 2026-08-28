export type CorrelatedDrawingOperation = {
  name: string;
  durationMs: number;
  attributes?: { actionId?: string; [key: string]: unknown };
};

export function createDrawingActionMeasurement<
  TSnapshot extends { operations: CorrelatedDrawingOperation[] }
>(input: {
  actionId: string;
  settledInteractionMs: number;
  automationWallMs: number;
  snapshot: TSnapshot;
}) {
  return {
    // Retained for frozen PLAN-001 evidence readers; new analysis uses the explicit field.
    elapsedMs: input.settledInteractionMs,
    settledInteractionMs: input.settledInteractionMs,
    automationWallMs: input.automationWallMs,
    calculationStages: input.snapshot.operations.filter(
      (sample) => sample.attributes?.actionId === input.actionId
    ),
    ...input.snapshot
  };
}
