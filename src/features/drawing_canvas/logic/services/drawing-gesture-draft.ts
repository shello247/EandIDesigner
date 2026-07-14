import type { DrawingModel } from "../../data/schema";

export type CanvasGestureDraft = {
  startModel: DrawingModel;
  previewModel: DrawingModel;
};

export function beginCanvasGesture(model: DrawingModel): CanvasGestureDraft {
  return { startModel: model, previewModel: model };
}

export function updateCanvasGesturePreview(
  draft: CanvasGestureDraft,
  updater: DrawingModel | ((current: DrawingModel) => DrawingModel)
): CanvasGestureDraft {
  const previewModel =
    typeof updater === "function" ? updater(draft.previewModel) : updater;
  return previewModel === draft.previewModel
    ? draft
    : { ...draft, previewModel };
}

export function commitCanvasGesture(draft: CanvasGestureDraft): {
  model: DrawingModel;
  changed: boolean;
} {
  return {
    model: draft.previewModel,
    changed: draft.previewModel !== draft.startModel
  };
}

export function cancelCanvasGesture(draft: CanvasGestureDraft): DrawingModel {
  return draft.startModel;
}
