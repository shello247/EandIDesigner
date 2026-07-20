import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";
import {
  beginCanvasGesture,
  cancelCanvasGesture,
  commitCanvasGesture,
  updateCanvasGesturePreview
} from "../logic/services/drawing-gesture-draft";

describe("canvas gesture drafts", () => {
  it("keeps preview mutations transient and commits the final model once", () => {
    const startModel = createDefaultDrawingModel();
    const firstPreview = {
      ...startModel,
      titleBlock: { ...startModel.titleBlock, drawingNumber: "PREVIEW-1" }
    };
    const finalPreview = {
      ...firstPreview,
      titleBlock: { ...firstPreview.titleBlock, drawingNumber: "PREVIEW-2" }
    };
    const started = beginCanvasGesture(startModel);
    const updated = updateCanvasGesturePreview(started, firstPreview);
    const final = updateCanvasGesturePreview(updated, finalPreview);
    const committed = commitCanvasGesture(final);

    expect(startModel.titleBlock.drawingNumber).not.toBe("PREVIEW-2");
    expect(committed).toEqual({ model: finalPreview, changed: true });
  });

  it("creates no change for identical previews and restores the start model on cancel", () => {
    const model = createDefaultDrawingModel();
    const draft = beginCanvasGesture(model);

    expect(updateCanvasGesturePreview(draft, model)).toBe(draft);
    expect(commitCanvasGesture(draft)).toEqual({ model, changed: false });
    expect(cancelCanvasGesture(draft)).toBe(model);
  });
});
