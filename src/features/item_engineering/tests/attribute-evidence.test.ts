import { expect, it } from "vitest";
import { itemProfileV3Schema } from "../data/profile-v3-schema";
import { validateProfileEvidence } from "../logic/services/attribute-evidence";

it("requires retained source identity and validates document pages", () => {
  const doc = { kind: "document", id: "document", contentHash: "a".repeat(64), page: 3 };
  const profile = itemProfileV3Schema.parse({ version: 3, deviceType: "io_module", groups: [], entries: [], modes: [], channels: [],
    terminals: [{ id: "t1", number: "1", function: "Input", connectable: true, shared: false, evidence: [doc] }] });
  expect(() => validateProfileEvidence(profile, { notes: [], documents: [] })).toThrow("retained content");
  expect(() => validateProfileEvidence(profile, { notes: [], documents: [{ id: "document", contentHash: "b".repeat(64) }] })).toThrow("retained content");
  expect(() => validateProfileEvidence(profile, { notes: [], documents: [{ id: "document", contentHash: "a".repeat(64) }] })).not.toThrow();
  profile.terminals[0].evidence = [{ ...doc, kind: "document", page: 0 }];
  expect(itemProfileV3Schema.safeParse(profile).success).toBe(false);
});
