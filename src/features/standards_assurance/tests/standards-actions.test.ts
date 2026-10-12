import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getStandardsDetailAction, saveStandardsContentAction, recordStandardsReviewAction } from "../api/actions";
describe("standards server validation", () => {
  it("rejects invalid kinds and payloads before persistence", async () => {
    expect(await getStandardsDetailAction({ kind: "DROP TABLE", entityId: "x" })).toMatchObject({ ok: false, code: "validation" });
    const result = await saveStandardsContentAction({ kind: "reference", content: {} });
    expect(result).toMatchObject({ ok: false, code: "validation" });
    if (!result.ok) expect(result.fieldErrors).toBeDefined();
  });
  it("does not accept an authenticated identity from the browser", async () => {
    expect(await recordStandardsReviewAction({ identity: "authenticated" })).toMatchObject({ ok: false, code: "validation" });
  });
});

