import { describe, expect, it } from "vitest";
import { acknowledgeSectionSave, sectionIsDirty, ItemWorkspaceMutationQueue, resolveNoteSelection } from "../logic/services/item-workspace-state";
describe("Item workspace state", () => {
  it("selects the first note, preserves a choice and follows saved replacements", () => {
    expect(resolveNoteSelection(["first", "second"], null)).toBe("first");
    expect(resolveNoteSelection(["first", "second"], "second")).toBe("second");
    expect(resolveNoteSelection(["replacement", "first"], "first", "replacement")).toBe("replacement");
    expect(resolveNoteSelection(["remaining"], "archived")).toBe("remaining");
    expect(resolveNoteSelection([], "old")).toBeNull();
    expect(resolveNoteSelection(["first", "second"], "second", "missing")).toBe("second");
  });
  it("acknowledges only submitted edits and preserves later edits", () => {
    const state = acknowledgeSectionSave({ saved: "old", draft: "later" }, "submitted", "normalized");
    expect(state).toEqual({ saved: "normalized", draft: "later" });
    expect(sectionIsDirty(state)).toBe(true);
    expect(sectionIsDirty(acknowledgeSectionSave({ saved: "old", draft: "submitted" }, "submitted", "normalized"))).toBe(false);
  });
  it("serializes cross-tab writes using the committed token", async () => {
    const queue = new ItemWorkspaceMutationQueue(null);
    const seen: (string | null)[] = [];
    await Promise.all(["notes", "profile", "documents"].map(id => queue.run(async token => {
      seen.push(token); await Promise.resolve(); return { value: id, revisionId: id };
    })));
    expect(seen).toEqual([null, "notes", "profile"]);
  });
  it("retains the token after failure and rejects another Item's delayed response", async () => {
    const queue = new ItemWorkspaceMutationQueue("original");
    await expect(queue.run(async () => { throw new Error("conflict"); })).rejects.toThrow("conflict");
    expect(queue.revisionId).toBe("original");
    let finish!: () => void;
    const result = queue.run(async () => { await new Promise<void>(resolve => { finish = resolve; }); return { value: 1, revisionId: "late" }; });
    await Promise.resolve();
    queue.invalidate(); finish();
    await expect(result).rejects.toThrow("ignored");
    expect(queue.revisionId).toBe("original");
  });
});
