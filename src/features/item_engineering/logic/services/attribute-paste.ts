import type { AttributeTypeSnapshot } from "@/features/engineering_attributes/api/public";
import type { SpecificationDraft } from "./specification-editor-draft";
import { editSpecification } from "./specification-editor-draft";

export function previewAttributePaste(text: string, types: AttributeTypeSnapshot[], groupKey: string, newId: () => string) {
  const lines = text.replace(/\r\n?/g,"\n").split("\n").filter(line => line.trim());
  if (lines.length > 500) return { rows: [] as SpecificationDraft[],errors: [{ row: 0,message: "Paste up to 500 rows at a time." }] };
  const rows: SpecificationDraft[] = []; const errors: Array<{row:number;message:string}> = [];
  lines.forEach((line,index) => {
    const [name,rawValue = "",rawUnit = "",condition = "",source = "",...extra] = line.split("\t");
    if (index === 0 && /^(specification|attribute|type)$/i.test(name.trim()) && /value/i.test(rawValue)) return;
    if (extra.length) { errors.push({ row: index+1,message: "Expected Specification, Value, Unit, Condition and Source columns." }); return; }
    const candidates = types.filter(t => t.definition.label.toLowerCase() === name.trim().toLowerCase());
    if (candidates.length !== 1) { errors.push({ row: index+1,message: `Choose an existing unambiguous type for “${name}”. Pasting cannot create global types.` }); return; }
    const type = candidates[0]; const raw = rawValue.trim().replaceAll("−","-");
    const entry = editSpecification({ id: newId(),groupKey,title: type.definition.label,description: "",type,
      payload: { kind: "unresolved",status: "missing",reason: "" },source: { kind: "manufacturer" },scope: { kind: "device" },modes: [],condition: condition.trim(),ratingBasis: "unspecified",evidence: source.trim() ? [{ kind: "engineer",reference: source.trim() }] : [] });
    if (raw) {
      if (type.definition.payloadKind !== "scalar") { errors.push({ row: index+1,message: "Use the rating editor for conditional ratings and terminal conductor limits." }); return; }
      entry.availability = "recorded";
      if (type.definition.valueKind === "range") {
        const match = raw.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:to|–|\.\.)\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/i);
        if (!match) { errors.push({ row: index+1,message: "Enter a range such as -20 to 70." }); return; }
        entry.value = { minimum: match[1],maximum: match[2],unit: rawUnit.trim() || type.definition.canonicalUnit || "" };
      } else entry.value = { value: raw,unit: rawUnit.trim() || type.definition.canonicalUnit || "" };
    }
    rows.push(entry);
  });
  return { rows,errors };
}
