import { expect,it } from "vitest";
import { itemProfileV3Schema } from "../data/profile-v3-schema";
function grvFixture() {
  return itemProfileV3Schema.parse({ version: 3,deviceType: "io_module",groups: [],entries: [],modes: [],
    terminals: Array.from({ length: 26 },(_,i) => ({ id: `t${i+1}`,number: `${i+1}`,function: i === 12 || i === 13 ? "Unused" : "Synthetic channel connection",connectable: i !== 12 && i !== 13,shared: false,evidence: [] })),
    channels: Array.from({ length: 8 },(_,i) => ({ id: `ch${i}`,number: `${i}`,direction: "input",signalType: "analog_current",ranges: [{ minimum: 4,maximum: 20,unit: "mA" }],evidence: [],
      terminals: Array.from({ length: 3 },(_,j) => ({ terminalId: `t${i*3+j+1+(i>=4?2:0)}`,function: `Synthetic function ${j+1}` })) })) });
}
it("preserves the accepted GRV channel numbering without inventing continuity", () => {
  const profile = grvFixture();
  expect(profile.channels[0].terminals.map(t => t.terminalId)).toEqual(["t1","t2","t3"]);
  expect(profile.channels[4].terminals[0].terminalId).toBe("t15");
  expect(profile.terminals.filter(t => !t.connectable).map(t => t.number)).toEqual(["13","14"]);
  expect(new Set(profile.channels.flatMap(c => c.terminals.map(t => t.terminalId))).size).toBe(24);
  expect(profile.channels.every(c => !Object.hasOwn(c,"continuity"))).toBe(true);
});
it("rejects channel use of unused terminals and incompatible signal units", () => {
  const profile = grvFixture(); profile.channels[0].terminals[0].terminalId = "t13";
  expect(itemProfileV3Schema.safeParse(profile).success).toBe(false);
  const wrongUnits = grvFixture(); wrongUnits.channels[0].ranges[0].unit = "V";
  expect(itemProfileV3Schema.safeParse(wrongUnits).success).toBe(false);
});
