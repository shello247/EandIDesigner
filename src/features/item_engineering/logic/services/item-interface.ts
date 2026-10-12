import type { SymbolMetadata } from "@/features/symbol_registry/api/public";
import type { ItemEngineeringRevision } from "../../data/schema";
import type { CompatibleProduct } from "../../data/product-selection-schema";
import { projectItemProfileV3 } from "./profile-v3-adapter";

export function symbolProductContract(metadata: SymbolMetadata) {
  return {layoutUsage:metadata.layoutUsage ?? "wiring",width:metadata.physicalWidthMm,height:metadata.physicalHeightMm,
    mountingType:metadata.mountingType,resizable:metadata.resizable ?? false,viewBox:metadata.viewBox,
    terminals:metadata.terminals,anchors:metadata.anchors,electricalTopology:metadata.electricalTopology,
    networkProfile:metadata.networkProfile,componentPositions:metadata.componentPositions,
    terminalStripCapability:metadata.terminalStripCapability,terminalBlockModule:metadata.terminalBlockModule};
}
export function validateProductCompatibility(metadata: SymbolMetadata, revision: ItemEngineeringRevision, option: CompatibleProduct) {
  const errors:string[]=[];const warnings:string[]=[];const profile=projectItemProfileV3(revision.profile);
  if(revision.id!==option.itemEngineeringRevisionId||revision.itemId!==option.itemId) errors.push("The selected revision does not belong to this Item.");
  const usage=metadata.layoutUsage ?? "wiring";
  if(option.usage!==usage && usage!=="both") errors.push("The Symbol does not support this representation usage.");
  const mappings=option.interface.terminalMappings;
  for(const mapping of mappings){
    const terminal=profile.terminals.find(t=>t.id===mapping.terminalId);
    const symbol=metadata.terminals.find(t=>t.key===mapping.symbolTerminalKey);
    if(!terminal?.connectable)errors.push(`Product terminal ${mapping.terminalId} is missing or non-connectable.`);
    if(!symbol || !metadata.anchors.some(a=>a.key===symbol.anchorKey))errors.push(`Symbol terminal ${mapping.symbolTerminalKey} has no valid anchor.`);
  }
  if(option.usage!=="panel_layout") {
    if(!profile.terminals.length)errors.push("Define the product terminals before qualifying wiring compatibility.");
    if(profile.terminals.some(t=>t.connectable&&!mappings.some(m=>m.terminalId===t.id)))errors.push("Map every connectable product terminal for wiring use.");
    if(metadata.terminals.some(t=>!mappings.some(m=>m.symbolTerminalKey===t.key)))errors.push("Every Symbol terminal must map to a connectable product terminal.");
  }
  for(const group of metadata.electricalTopology?.permanentContinuityGroups ?? []) {
    const isolation=new Set(group.terminalKeys.map(key=>profile.terminals.find(t=>t.id===mappings.find(m=>m.symbolTerminalKey===key)?.terminalId)?.isolationGroup).filter(Boolean));
    if(isolation.size>1)errors.push("Symbol continuity joins product terminals with different isolation identities.");
  }
  if(option.usage!=="wiring") {
    if(!metadata.physicalWidthMm||!metadata.physicalHeightMm) errors.push("Panel compatibility requires qualified Symbol width and height.");
    if(metadata.resizable)warnings.push("This representation is resizable; dimension checks must use the placed size.");
  }
  return {valid:errors.length===0,errors,warnings};
}
