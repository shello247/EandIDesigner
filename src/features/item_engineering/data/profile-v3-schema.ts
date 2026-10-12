import { z } from "zod";
import { normalizeEngineeringValue, convertEngineeringUnit } from "@/features/engineering_attributes/api/public";
import { itemAttributeEntrySchema, attributePayloadSchema, itemProfileV2Schema } from "./attribute-schema";

const key = z.string().trim().min(1).max(160);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const attributeEvidenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("document"), id: key, contentHash: hash,
    page: z.number().int().positive().optional(), section: z.string().trim().max(240).optional() }),
  z.strictObject({ kind: z.literal("note"), id: key, contentHash: hash,
    section: z.string().trim().max(240).optional() }),
  z.strictObject({ kind: z.literal("url"), url: z.url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS source."),
    label: z.string().trim().max(240), accessedAt: z.iso.date().optional() }),
  z.strictObject({ kind: z.literal("engineer"), reference: z.string().trim().min(1).max(2000) })
]);
export type AttributeEvidence = z.infer<typeof attributeEvidenceSchema>;
const evidence = z.array(attributeEvidenceSchema).max(32);
export const specificationScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("device") }),
  z.strictObject({ kind: z.enum(["supply_input", "supply_output"]), id: key }),
  z.strictObject({ kind: z.literal("channel"), id: key }),
  z.strictObject({ kind: z.literal("terminal"), id: key })
]);
export const specificationPayloadSchema = z.union([attributePayloadSchema,
  z.strictObject({ kind: z.literal("unresolved"), status: z.enum(["missing", "needs_review"]), reason: z.string().trim().max(2000) }),
  z.strictObject({ kind: z.literal("conductor_size"), gauge: z.string().trim().min(1).max(10), system: z.literal("AWG") })
]);
export const specificationEntrySchema = itemAttributeEntrySchema.extend({
  payload: specificationPayloadSchema,
  scope: specificationScopeSchema,
  modes: z.array(z.strictObject({ setId: key, choiceId: key })).max(16),
  condition: z.string().trim().max(2000),
  evidence,
  ratingBasis: z.enum(["continuous", "transient", "test", "unspecified"])
});
export type SpecificationEntry = z.infer<typeof specificationEntrySchema>;
export const productTerminalSchema = z.strictObject({
  id: key, number: key, function: z.string().trim().min(1).max(240), connectable: z.boolean(),
  shared: z.boolean(), isolationGroup: key.optional(), evidence
});
export const productChannelSchema = z.strictObject({
  id: key, number: key, direction: z.enum(["input", "output", "bidirectional", "unknown"]),
  signalType: z.enum(["analog_current", "analog_voltage", "digital", "relay", "serial", "other", "unknown"]),
  ranges: z.array(z.strictObject({ minimum: z.number().finite(), maximum: z.number().finite(), unit: key })).max(32),
  terminals: z.array(z.strictObject({ terminalId: key, function: z.string().trim().min(1).max(240),
    role: z.enum(["signal", "return", "supply", "shield", "other"]).optional() })).max(256), evidence
});
export const itemProfileV3Schema = z.strictObject({
  version: z.literal(3), deviceType: itemProfileV2Schema.shape.deviceType,
  groups: itemProfileV2Schema.shape.groups,
  modes: z.array(z.strictObject({ id: key, label: key,
    choices: z.array(z.strictObject({ id: key, label: key })).min(2).max(32) })).max(16),
  terminals: z.array(productTerminalSchema).max(2048), channels: z.array(productChannelSchema).max(1024),
  entries: z.array(specificationEntrySchema).max(2048)
}).superRefine((profile, ctx) => {
  const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const unique = (rows: Array<{ id: string }>, path: string) => {
    const seen = new Set<string>(); rows.forEach((row, i) => { if (seen.has(row.id)) fail([path, i, "id"], "Identities must be unique."); seen.add(row.id); });
  };
  for (const name of ["modes", "terminals", "channels", "entries"] as const) unique(profile[name], name);
  if (new Set(profile.groups.map(g => g.key)).size !== profile.groups.length) fail(["groups"], "Group identities must be unique.");
  for (const name of ["terminals", "channels"] as const) {
    if (new Set(profile[name].map(row => row.number)).size !== profile[name].length) fail([name], "Displayed numbers must be unique.");
  }
  profile.modes.forEach((mode, i) => { if (new Set(mode.choices.map(c => c.id)).size !== mode.choices.length) fail(["modes", i, "choices"], "Mode choices must be unique."); });
  const memberships = new Map<string, number>();
  profile.channels.forEach((channel, i) => {
    const seen = new Set<string>();
    channel.terminals.forEach((member, j) => {
      const terminal = profile.terminals.find(t => t.id === member.terminalId);
      if (!terminal?.connectable) fail(["channels", i, "terminals", j], "Channel membership requires a connectable product terminal.");
      if (seen.has(member.terminalId)) fail(["channels", i, "terminals", j], "A channel must reference each terminal only once.");
      seen.add(member.terminalId); memberships.set(member.terminalId, (memberships.get(member.terminalId) ?? 0) + 1);
    });
    channel.ranges.forEach((range, j) => {
      if (range.minimum > range.maximum) fail(["channels", i, "ranges", j], "Maximum must be at least the minimum.");
      const dimension = channel.signalType === "analog_current" ? "current" : channel.signalType === "analog_voltage" ? "voltage" : undefined;
      if (dimension && !convertEngineeringUnit(range.minimum,dimension,range.unit,range.unit).ok)
        fail(["channels",i,"ranges",j,"unit"], "Use units compatible with the channel signal type.");
    });
  });
  profile.terminals.forEach((terminal, i) => {
    if ((memberships.get(terminal.id) ?? 0) > 1 && (!terminal.shared || terminal.evidence.length === 0)) fail(["terminals", i], "Shared channel terminals require an explicit shared designation and evidence.");
  });
  const duplicates = new Set<string>();
  profile.entries.forEach((entry, i) => {
    const at = ["entries", i];
    if (!profile.groups.some(g => g.key === entry.groupKey)) fail([...at, "groupKey"], "Specification group was not found.");
    const scope = entry.scope;
    if (scope.kind === "channel" && !profile.channels.some(c => c.id === scope.id)) fail([...at, "scope"], "Channel was not found.");
    if (scope.kind === "terminal" && !profile.terminals.some(t => t.id === scope.id)) fail([...at, "scope"], "Terminal was not found.");
    const modeSets = new Set<string>();
    entry.modes.forEach((mode, j) => {
      if (modeSets.has(mode.setId) || !profile.modes.find(m => m.id === mode.setId)?.choices.some(c => c.id === mode.choiceId)) fail([...at, "modes", j], "Select one existing choice per operating mode.");
      modeSets.add(mode.setId);
    });
    // Value conflicts are retained for review. Only exactly duplicated entries are rejected.
    const signature = JSON.stringify([entry.groupKey, entry.type.typeId, entry.scope, [...entry.modes].sort((a,b) => a.setId.localeCompare(b.setId)), entry.condition, entry.ratingBasis, entry.payload]);
    if (duplicates.has(signature)) fail(at, "This specification value, scope and condition are already recorded.");
    duplicates.add(signature);
    if (entry.payload.kind === "unresolved") return;
    const payload = entry.payload; const definition = entry.type.definition;
    if (payload.kind === "conductor_size" && (definition.engineeringDimension !== "cross_section" || definition.payloadKind !== "scalar" || definition.valueKind !== "quantity"))
      fail([...at, "payload"], "AWG requires a conductor area specification.");
    if (["quantity", "range", "number", "conductor_size"].includes(payload.kind)) {
      const result = normalizeEngineeringValue({ value: payload as Parameters<typeof normalizeEngineeringValue>[0]["value"],
        dimension: definition.engineeringDimension, canonicalUnit: definition.canonicalUnit });
      if (!result.ok) fail([...at, "payload"], result.message);
      else for (const n of [result.value, result.minimum, result.maximum].filter((n): n is number => n !== undefined)) {
        if (definition.minimum !== undefined && (definition.minimumExclusive ? n <= definition.minimum : n < definition.minimum) || definition.maximum !== undefined && n > definition.maximum)
          fail([...at, "payload"], "Value is outside the permitted range.");
      }
    }
    if (payload.kind === "conductor_size") return;
    // Reuse legacy structural/value validation without its classification restriction.
    const checked = itemProfileV2Schema.safeParse({ version: 2, deviceType: profile.deviceType,
      groups: profile.groups, entries: [{ id: entry.id, groupKey: entry.groupKey, title: entry.title,
        description: entry.description, type: { ...entry.type, definition: { ...entry.type.definition, applicableAssetTypes: undefined,
          minimum: undefined, maximum: undefined } },
        payload: entry.payload, source: { ...entry.source, reference: entry.source.reference || (entry.evidence.length ? "Structured evidence" : undefined) } }] });
    if (!checked.success) for (const issue of checked.error.issues) fail([...at, "payload"], issue.message);
  });
});
export type ItemProfileV3 = z.infer<typeof itemProfileV3Schema>;
export type ProductChannel = z.infer<typeof productChannelSchema>;
export type ProductTerminal = z.infer<typeof productTerminalSchema>;
