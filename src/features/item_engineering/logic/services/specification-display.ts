import type {SpecificationEntry} from "../../data/profile-v3-schema";
export function specificationValueLabel(entry:SpecificationEntry){
  const p=entry.payload;
  if(p.kind==="unresolved")return p.status==="missing"?"Missing":"Needs review";
  if(p.kind==="range")return `${p.minimum} to ${p.maximum} ${p.unit}`;
  if(p.kind==="quantity")return `${p.value} ${p.unit}`;
  if(p.kind==="conductor_size")return `${p.gauge} AWG`;
  if("value" in p)return typeof p.value==="boolean"?(p.value?"Yes":"No"):String(p.value);
  if(p.kind==="terminal_range")return `${p.minimumMm2} to ${p.maximumMm2} mm² · ${p.conductorClass} · ${p.termination}`;
  if(p.kind==="short_circuit")return `${p.currentKa} kA at ${p.voltageV} V ${p.supplyNature.toUpperCase()}`;
  return "Structured rating";
}
