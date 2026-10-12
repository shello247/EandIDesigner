import type {DrawingModel} from "@/features/drawing_canvas/data/schema";
import type {PhysicalProduct} from "@/features/drawing_canvas/api/product-contracts";
import type {ProductInterface} from "@/features/item_engineering/api/public";
import type {PanelConnectivityGraph} from "@/features/drawing_panel_wiring/types";
import {namespaceStructuredTerminalKey} from "@/features/drawing_terminal_blocks/api/public";
export type ProductConnection={terminalId:string;symbolTerminalKey:string;nodeId:string;side:string;netId?:string;connections:Array<{id:string;label:string;size?:string}>};
/** Product memberships never create nodes, nets or electrical continuity. */
export function productConnectionIndex(model:DrawingModel,graph:PanelConnectivityGraph,subject:PhysicalProduct,definition?:ProductInterface):ProductConnection[]{
  if(subject.target.componentPath.length||!definition)return [];
  const member=subject.target.memberId?model.assets.find(a=>a.id===subject.target.assetId)?.terminalStrip?.members.find(m=>m.id===subject.target.memberId):undefined;
  if(subject.target.memberId&&!member)return [];
  const mappings=new Map(definition.terminalMappings.map(m=>[member?namespaceStructuredTerminalKey(member.token,m.symbolTerminalKey):m.symbolTerminalKey,m.terminalId]));
  const rows:ProductConnection[]=[];
  for(const node of graph.electricalNodesById.values()){
    if(node.kind!=="terminal_side"||node.terminal.assetId!==subject.target.assetId)continue;
    const terminalId=mappings.get(node.terminal.terminalKey);if(!terminalId)continue;
    const relationships=(graph.relationshipIdsByElectricalNodeId.get(node.id)??[]).flatMap(id=>{const r=graph.conductiveRelationshipsById.get(id);return r&&["internal_wire","drawing_connection"].includes(r.kind)?[r]:[];});
    rows.push({terminalId,symbolTerminalKey:node.terminal.terminalKey,nodeId:node.id,side:node.terminal.side,netId:graph.electricalNetIdByNodeId.get(node.id),connections:relationships.map(r=>{const wire=r.kind==="internal_wire"&&r.provenance.recordId?graph.internalWiresById.get(r.provenance.recordId):undefined;return {id:r.id,label:r.provenance.label,size:wire?.specification?.size??wire?.attributes?.size};})});
  }
  return rows;
}
