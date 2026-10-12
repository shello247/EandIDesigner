import {projectItemProfileV3} from "@/features/item_engineering/api/public";
import type {PanelAnalysisRuleContext} from "./panel-analysis-rule-set";
import type {PanelAnalysisFindingDraft,PanelAnalysisRule} from "./panel-analysis-rules";
import {checkProductDimensions,checkProductSignals,checkProductTerminals,checkRequiredProductInformation} from "./product-engineering-checks";

export function productFinding(context:PanelAnalysisRuleContext, input:{key:string;assetIds:string[];title:string;problem:string;action:string;provisional?:boolean;error?:boolean;evidence?:PanelAnalysisFindingDraft["evidence"]}):PanelAnalysisFindingDraft {
  const assetIds=[...new Set(input.assetIds)];
  const sources=(context.products??[]).filter(p=>assetIds.includes(p.target.assetId)&&p.product.revision).map(p=>{
    const revision=p.product.revision!;const profile=projectItemProfileV3(revision.profile);
    const references=[...new Map([...profile.entries.flatMap(e=>e.evidence),...profile.channels.flatMap(c=>c.evidence),...profile.terminals.flatMap(t=>t.evidence)].map(e=>[JSON.stringify(e),e])).values()];
    return {label:`${p.label} product source`.slice(0,160),value:`${revision.identity.displayName} · Item revision ${revision.revisionNumber}${references.length>32?" · additional sources in the revision record":""}`.slice(0,1000),productSource:{itemId:revision.itemId,revisionId:revision.id,references:references.slice(0,32)}};
  });
  const occurrences=assetIds.flatMap(id=>context.graph.occurrencesByAssetId.get(id)??[]);
  return {findingKey:input.key,severity:input.provisional?"data_gap":input.error?"error":"warning",evidenceLevel:input.provisional?"inferred":"verified",title:input.title,problem:input.problem.slice(0,1000),significance:"The selected product and project configuration determine the engineering result.",recommendedAction:input.action,rootCauseKey:input.key,panelAssetIds:[...context.graph.panelAssetIds].filter(id=>assetIds.some(assetId=>context.graph.panelAssetIdsByAssetId.get(assetId)?.has(id))),assetIds,affectedRecords:assetIds.map(id=>({kind:"asset",id,assetId:id,label:context.graph.assetsById.get(id)?.tag??id})),evidence:[...(input.evidence??[]),...sources],locations:occurrences.flatMap(o=>{const sheet=context.graph.sheetsById.get(o.sheetId);return sheet?[{sheetId:sheet.id,sheetNumber:sheet.sheetNumber,sheetName:sheet.name,objectKind:"placement" as const,objectId:o.placementId}]:[];})};
}

export function powerBudgetRule():PanelAnalysisRule<PanelAnalysisRuleContext>{
  return {code:"product.power_budget",version:"1",category:"power_budget",isApplicable:({powerAnalysis:p})=>p&&(p.budgets.length||p.unassigned.length)?{applicable:true}:{applicable:false,reason:"No recorded loads or explicit power assignments."},evaluate:context=>{
    const analysis=context.powerAnalysis!;const findings:PanelAnalysisFindingDraft[]=[];
    for(const budget of analysis.budgets){
      if(budget.status==="verified")continue;
      const exceeded=budget.status==="exceeded";const incompatible=budget.status==="incompatible";
      findings.push(productFinding(context,{key:budget.id,assetIds:[budget.supplyAssetId,...budget.loads.map(l=>l.assetId)],title:`${budget.supplyLabel}: ${exceeded?"output capacity exceeded":incompatible?"supply configuration conflict":budget.status==="provisional"?"provisional power budget":"incomplete power budget"}`,problem:[`${budget.knownSubtotal} ${budget.unit} known subtotal; ${budget.capacity===undefined?"capacity missing":`${budget.capacity} ${budget.unit} capacity`}.`,...budget.reasons,...budget.loads.flatMap(l=>l.reasons.map(r=>`${l.label}: ${r}`))].join(" "),action:"Review the assigned supply output, operating modes and source-backed input/capacity ratings in the Power Budgets tab.",provisional:!exceeded&&!incompatible||budget.provisional,error:exceeded||incompatible,evidence:[{label:"Coverage",value:budget.coverage},{label:"Power basis",value:`${budget.unit}; ${budget.outputId}`}]}));
    }
    for(const row of analysis.unassigned)findings.push(productFinding(context,{key:`unassigned:${row.key}`,assetIds:[row.assetId],title:`${row.label}: supply assignment missing`,problem:row.reason,action:"Assign the physical load to an explicit supply output in its project engineering settings.",provisional:true}));
    return findings.length?{status:"finding",findings,...(analysis.unassigned.length||analysis.budgets.some(b=>b.coverage==="partial")?{coverage:"partial" as const}:{})}:{status:"passed"};
  }};
}

export function focusedProductRules(context:PanelAnalysisRuleContext):PanelAnalysisRule<PanelAnalysisRuleContext>[] {
  return ([
    ["product.required_information","engineering_metadata",checkRequiredProductInformation],
    ["product.signal_compatibility","signal_compatibility",checkProductSignals],
    ["product.terminal_compatibility","terminal_occupancy",checkProductTerminals],
    ["product.dimension_consistency","dimension_consistency",checkProductDimensions]
  ] as const).map(([code,category,check])=>{
    const result=check(context);
    return {code,version:"1",category,isApplicable:()=>result.applicable?{applicable:true}:{applicable:false,reason:"No applicable selected product configuration or installed connection."},evaluate:()=>result.issues.length?{status:"finding",findings:result.issues.map(issue=>productFinding(context,issue)),...(result.issues.some(i=>i.provisional)?{coverage:"partial" as const}:{})}:{status:"passed"}};
  });
}
