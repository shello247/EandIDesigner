import { test,expect,type Page } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { assertAuditDatabase,resolveAuditConfiguration } from "../../scripts/drawing-performance-audit/run-config.mjs";
import { saveItemAttributeBatch } from "../../src/features/item_engineering/data/attribute-batches";
import { getLatestItemEngineeringRevision } from "../../src/features/item_engineering/data/queries";
import {createItemEngineeringRevision} from "../../src/features/item_engineering/data/mutations";
import {getCurrentAttributeType} from "../../src/features/engineering_attributes/data/type-catalogue";
import {attributeTypeSnapshotSchema} from "../../src/features/engineering_attributes/data/type-schema";
import {itemProfileV3Schema,type SpecificationEntry} from "../../src/features/item_engineering/api/public";
import {saveProductConfiguration,getLatestProductConfiguration} from "../../src/features/item_engineering/data/product-configurations";
import {symbolMetadataSchema} from "../../src/features/symbol_registry/data/schema";
import {createDefaultDrawingModel,stringifyDrawingModel,parseDrawingModelJson} from "../../src/features/drawing_canvas/data/schema";
import {loadSelectedProductBom} from "../../src/features/bom_creator/data/selected-product-bom";
import {listDrawingRenderSymbols} from "../../src/features/symbol_registry/api/public";

async function fixture(page: Page) {
  assertAuditDatabase(resolveAuditConfiguration());
  const id = crypto.randomUUID(); const item = await prisma.bomItem.create({ data: { itemKey: `ATTR-V3-${id}`,displayName: `Synthetic I/O ${id}`,category: "io_module",unit: "each",status: "active" } });
  await saveItemAttributeBatch({ itemId: item.id,expectedLatestRevisionId: null,additions: [],updates: [],removals: [],profile: { deviceType: "io_module",groups: [{ key: "device",label: "Device",context: "device" }],modes: [],terminals: [],channels: [] } });
  await page.goto(`/bom/items/${item.id}`); await page.getByRole("tab",{ name: "Engineering Attributes",exact: true }).click();
  await expect(page.getByRole("button",{ name: "Add specification",exact: true })).toBeVisible(); return item;
}
async function add(page: Page,name: string) {
  await page.getByRole("button",{ name: "Add specification",exact: true }).click();
  const dialog = page.getByRole("dialog",{ name: "Add specification",exact: true });
  await dialog.getByLabel("Search specification types").fill(name);
  await dialog.getByRole("button").filter({ has: page.getByText(name,{ exact: true }) }).click();
  await expect(dialog).toHaveCount(0);
}
test("batch editing, hidden tab draft, explicit missing values, unit conversion and reload",async ({page}) => {
  const errors: string[] = []; page.on("pageerror",e => errors.push(e.message)); const item = await fixture(page);
  await add(page,"Operating temperature range");
  await page.getByLabel("Operating temperature range information status").selectOption("recorded");
  await page.getByLabel("Operating temperature range Minimum",{exact:true}).fill("-20"); await page.getByLabel("Operating temperature range Maximum",{exact:true}).fill("70");
  await add(page,"Length"); await page.getByLabel("Length information status",{exact:true}).selectOption("recorded"); await page.getByLabel("Length Value",{exact:true}).fill("50");
  await page.getByRole("tab",{name:"Overview",exact:true}).click(); await page.getByRole("tab",{name:"Engineering Attributes",exact:true}).click();
  await expect(page.getByLabel("Length Value",{exact:true})).toHaveValue("50");
  const before = await prisma.bomItemEngineeringRevision.count({where:{itemId:item.id}});
  await page.getByRole("button",{name:"Save changes",exact:true}).click(); await expect(page.getByText("Specifications saved.",{exact:true})).toBeVisible();
  expect(await prisma.bomItemEngineeringRevision.count({where:{itemId:item.id}})).toBe(before+1);
  await page.getByLabel("Length units",{exact:true}).selectOption("cm"); await expect(page.getByLabel("Length Value",{exact:true})).toHaveValue("5");
  await page.getByRole("button",{name:"Save changes",exact:true}).click(); await expect(page.getByText("Specifications saved.",{exact:true})).toBeVisible();
  await page.reload(); await page.getByRole("tab",{name:"Engineering Attributes",exact:true}).click(); await expect(page.getByLabel("Length Value",{exact:true})).toHaveValue("5");
  await page.getByLabel("Length Value",{exact:true}).fill(""); await page.getByRole("button",{name:"Save changes",exact:true}).click(); await expect(page.getByText("Correct the highlighted values.",{exact:false})).toBeVisible();
  await page.getByLabel("Length information status",{exact:true}).selectOption("missing"); await page.getByRole("button",{name:"Save changes",exact:true}).click(); await expect(page.getByText("Specifications saved.",{exact:true})).toBeVisible();
  const saved = await getLatestItemEngineeringRevision(item.id); expect(saved?.profile.version).toBe(3); if (saved?.profile.version === 3) expect(saved.profile.entries.find(e => e.title === "Length")?.payload.kind).toBe("unresolved");
  await page.setViewportSize({width:420,height:900}); await expect(page.getByRole("button",{name:"Add specification",exact:true})).toBeVisible(); expect(errors).toEqual([]);
});
test("paste preview and templates do not infer missing ratings",async ({page}) => {
  await fixture(page); await page.getByRole("button",{name:"Paste rows",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Paste specifications",exact:true});
  await dialog.getByLabel("Pasted specification rows").fill("Operating temperature range\t-20 to 70\t°C\nLength\t\tmm"); await dialog.getByRole("button",{name:"Preview rows",exact:true}).click();
  await expect(dialog.getByText("Missing",{exact:true})).toBeVisible(); await dialog.getByRole("button",{name:"Add rows to draft",exact:true}).click();
  await expect(page.getByLabel("Length information status",{exact:true})).toHaveValue("missing");
  await page.getByRole("button",{name:"Cancel changes",exact:true}).click(); await page.getByRole("button",{name:"Add from template",exact:true}).click();
  const templates=page.getByRole("dialog",{name:"Add from template",exact:true}); await templates.getByRole("button",{name:"Preview rows",exact:true}).click(); await templates.getByRole("button",{name:"Add rows to draft",exact:true}).click();
  await expect(page.getByLabel("I/O channel count information status",{exact:true})).toHaveValue("missing");
});

test("keeps in-flight edits, resolves a stale revision explicitly and opens archived Items read-only",async({page})=>{
  const item=await fixture(page);await add(page,"Length");await page.getByLabel("Length information status",{exact:true}).selectOption("recorded");await page.getByLabel("Length Value",{exact:true}).fill("50");
  let release!:()=>void;const held=new Promise<void>(r=>{release=r;});let persisted!:()=>void;const written=new Promise<void>(r=>{persisted=r;});let first=true;
  await page.route(`**/bom/items/${item.id}`,async route=>{if(route.request().method()!=="POST"||!first){await route.continue();return;}first=false;const response=await route.fetch();persisted();await held;await route.fulfill({response});});
  await page.getByRole("button",{name:"Save changes",exact:true}).click();await written;await page.getByLabel("Length Value",{exact:true}).fill("60");release();
  await expect(page.getByText("Specifications saved.",{exact:true})).toBeVisible();await expect(page.getByLabel("Length Value",{exact:true})).toHaveValue("60");await expect(page.getByRole("button",{name:"Save changes",exact:true})).toBeEnabled();
  const before=await getLatestItemEngineeringRevision(item.id);if(!before||before.profile.version!==3)throw new Error("Missing saved fixture profile");
  const changed=structuredClone(before.profile);const length=changed.entries[0];if(length.payload.kind!=="quantity")throw new Error("Wrong fixture type");length.payload.value=55;
  await createItemEngineeringRevision({itemId:item.id,expectedLatestRevisionId:before.id,profile:changed,noteIds:[],documentIds:[]});
  await page.getByRole("button",{name:"Save changes",exact:true}).click();const conflict=page.getByRole("dialog",{name:"Review specification conflict",exact:true});await expect(conflict).toBeVisible();await conflict.getByRole("combobox").selectOption("draft");await conflict.getByRole("button",{name:"Use combined draft",exact:true}).click();await expect(page.getByLabel("Length Value",{exact:true})).toHaveValue("60");
  await page.getByRole("button",{name:"Save changes",exact:true}).click();await expect(page.getByText("Specifications saved.",{exact:true})).toBeVisible();
  await prisma.bomItem.update({where:{id:item.id},data:{status:"archived"}});await page.reload();await page.getByRole("tab",{name:"Engineering Attributes",exact:true}).click();await expect(page.getByLabel("Length Value",{exact:true})).toHaveValue("60");await expect(page.getByLabel("Length Value",{exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Save changes",exact:true})).toHaveCount(0);
});

test("qualifies a product, selects it in a drawing, saves project settings and interrogates pinned analysis",async({page},info)=>{
  test.setTimeout(180000);assertAuditDatabase(resolveAuditConfiguration());const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const unique=crypto.randomUUID();const device=await prisma.bomItem.create({data:{itemKey:`IO-${unique}`,displayName:`Synthetic Module ${unique}`,partNumber:"GRV-SYNTHETIC",category:"io_module",unit:"each",status:"active"}});
  const power=await prisma.bomItem.create({data:{itemKey:`PS-${unique}`,displayName:`Synthetic Supply ${unique}`,partNumber:"PS-SYNTHETIC",category:"power_supply",unit:"each",status:"active"}});
  async function typeSnapshot(key:string){const value=await getCurrentAttributeType(key);if(!value)throw new Error(`Missing fixture type ${key}`);return attributeTypeSnapshotSchema.parse({typeId:value.typeId,revisionId:value.revisionId,revisionNumber:value.revisionNumber,analysisKey:value.analysisKey,definition:value.definition});}
  const powerType=await typeSnapshot("attribute_type_active_power_consumption");const capacityType=await typeSnapshot("attribute_type_supply_output_capacity_w");
  const evidence=[{kind:"url" as const,url:"https://example.com/synthetic-qualification",label:"Synthetic test evidence"}];
  const entry=(id:string,value:number):SpecificationEntry=>({id,groupKey:"device",title:"Power consumption",description:"",type:powerType,payload:{kind:"quantity",value,unit:"W"},scope:{kind:"device"},modes:[{setId:"loop",choiceId:id}],condition:"",ratingBasis:"continuous",evidence,source:{kind:"manufacturer",reference:"Synthetic test fixture"}});
  const profile=itemProfileV3Schema.parse({version:3,deviceType:"io_module",groups:[{key:"device",label:"Device",context:"device"}],modes:[{id:"loop",label:"Loop power",choices:[{id:"external",label:"External"},{id:"chassis",label:"Chassis"}]}],entries:[entry("external",1.8),entry("chassis",4.5)],terminals:[1,2,3].map(n=>({id:`t${n}`,number:String(n),function:n===2?"Signal":"Synthetic connection",connectable:true,shared:false,isolationGroup:"ch0",evidence})),channels:[{id:"ch0",number:"0",direction:"input",signalType:"analog_current",ranges:[{minimum:4,maximum:20,unit:"mA"}],terminals:[{terminalId:"t1",function:"Supply",role:"supply"},{terminalId:"t2",function:"Signal",role:"signal"},{terminalId:"t3",function:"Return",role:"return"}],evidence}]});
  const revision=(await createItemEngineeringRevision({itemId:device.id,expectedLatestRevisionId:null,profile,noteIds:[],documentIds:[]})).revision;
  const supplyProfile=itemProfileV3Schema.parse({...profile,deviceType:"power_supply",modes:[],channels:[],terminals:[],entries:[{...entry("capacity",10),type:capacityType,title:"Output capacity",modes:[],scope:{kind:"supply_output",id:"main"}}]});
  const supplyRevision=(await createItemEngineeringRevision({itemId:power.id,expectedLatestRevisionId:null,profile:supplyProfile,noteIds:[],documentIds:[]})).revision;
  const category=await prisma.symbolCategory.findUniqueOrThrow({where:{normalizedName:"other"}});
  async function symbol(label:string,terminals:boolean){const key=`attr-${label}-${unique}`;const metadata=symbolMetadataSchema.parse({symbolKey:key,displayName:`Synthetic ${label}`,category:"controller",layoutUsage:"both",physicalWidthMm:40,physicalHeightMm:100,viewBox:{x:0,y:0,width:40,height:100},anchors:terminals?[1,2,3].map(n=>({key:`a${n}`,x:0,y:n*20,kind:"terminal"})):[],terminals:terminals?[1,2,3].map(n=>({key:String(n),label:String(n),anchorKey:`a${n}`,panelSide:"single"})):[]});return prisma.symbol.create({data:{symbolKey:key,displayName:metadata.displayName,category:"controller",categoryId:category.id,status:"approved",versions:{create:{versionNumber:1,status:"approved",svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 100"><rect x="1" y="1" width="38" height="98" fill="white" stroke="black"/></svg>',metadataJson:JSON.stringify(metadata)}}},include:{versions:true}});}
  const ioSymbol=await symbol("I/O",true);const psSymbol=await symbol("Supply",false);
  const supplyConfig=(await saveProductConfiguration({symbolVersionId:psSymbol.versions[0].id,expectedConfigurationId:null,options:[{itemId:power.id,itemEngineeringRevisionId:supplyRevision.id,usage:"panel_layout",evidence:"Synthetic qualified outline",interface:{terminalMappings:[]}}],parts:[]})).configuration;
  await page.goto(`/symbols/${ioSymbol.id}`);await page.getByRole("tab",{name:"Compatible Items",exact:true}).click();await page.getByRole("button",{name:"Add compatible Item",exact:true}).click();const picker=page.getByRole("dialog",{name:"Choose Item",exact:true});await picker.getByLabel("Search Items").fill(device.displayName);await picker.getByRole("button",{name:"Search",exact:true}).click();await picker.getByRole("button").filter({hasText:device.displayName}).click();
  await page.getByLabel("Compatibility basis",{exact:true}).fill("Synthetic reviewed three-terminal interface");await page.getByText("Terminal mapping · 0 mapped",{exact:true}).click();for(const n of [1,2,3])await page.getByLabel(`Map terminal ${n}`,{exact:true}).selectOption(String(n));await page.getByRole("button",{name:"Save product configuration",exact:true}).click();await expect(page.getByText(/^Compatible products saved\./)).toBeVisible();const configuration=await getLatestProductConfiguration(ioSymbol.versions[0].id);expect(configuration).not.toBeNull();
  const model=createDefaultDrawingModel();model.assets=[{id:"AI1",tag:"AI-1",title:"Synthetic Module",type:"io_module",symbolId:ioSymbol.id,versionId:ioSymbol.versions[0].id},{id:"PS1",tag:"PS-1",title:"Synthetic Supply",type:"power_supply",symbolId:psSymbol.id,versionId:psSymbol.versions[0].id,productSelection:{version:1,status:"selected",configurationId:supplyConfig.id,itemId:power.id,itemEngineeringRevisionId:supplyRevision.id}}];model.version=3;model.sheets[0].placements=model.assets.map((a,i)=>({id:`p${i}`,assetId:a.id,symbolId:a.symbolId!,versionId:a.versionId!,role:"device",tag:a.tag,x:40+i*80,y:60,rotation:0,scale:.6}));
  const drawing=await prisma.drawing.create({data:{drawingKey:`attribute-${unique}`,title:"Synthetic Attribute Workflow",description:"Synthetic qualification fixture",status:"draft",modelJson:stringifyDrawingModel(model)}});
  const focus=`/drawings/${drawing.id}?sheetId=${model.sheets[0].id}&objectKind=placement&objectId=p0`;await page.goto(focus);await expect(page.getByRole("heading",{name:"Selected product",exact:true})).toBeVisible();await page.getByLabel("Compatible product",{exact:true}).selectOption(revision.id);await page.getByRole("button",{name:"Use this product",exact:true}).click();await expect(page.getByText("Project settings, supply and assumptions",{exact:true})).toBeVisible();
  await page.getByText("Project settings, supply and assumptions",{exact:true}).click();await page.getByLabel("Loop power",{exact:true}).selectOption("external");await page.getByLabel("Assigned supply",{exact:true}).selectOption('["PS1",null,[]]');await page.getByLabel("Supply output identity",{exact:true}).fill("main");await page.getByLabel("Supply type",{exact:true}).selectOption("dc");await page.getByLabel("Channel 0 operating range",{exact:true}).selectOption(JSON.stringify([4,20,"mA"]));await page.getByRole("button",{name:"Apply project settings",exact:true}).click();await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
  await page.goto(`/panel-analysis/${drawing.id}`);await page.getByRole("button",{name:"Power Budgets",exact:true}).click();await expect(page.getByLabel("Power budgets")).toContainText("1.8 W");await expect(page.getByLabel("Power budgets")).toContainText("Verified");await page.getByRole("button",{name:"I/O Schedule",exact:true}).click();await expect(page.getByLabel("I/O schedule",{exact:true})).toContainText("4 to 20 mA");await expect(page.getByRole("link",{name:"Item revision 1",exact:true})).toHaveCount(3);await page.getByRole("button",{name:"View 1 source",exact:true}).first().click();await expect(page.getByRole("link",{name:"Synthetic test evidence",exact:true})).toBeVisible();await page.screenshot({path:info.outputPath("io-schedule.png"),fullPage:true});
  const changed=structuredClone(profile);if(changed.entries[0].payload.kind==="quantity")changed.entries[0].payload.value=99;await createItemEngineeringRevision({itemId:device.id,expectedLatestRevisionId:revision.id,profile:changed,noteIds:[],documentIds:[]});await page.reload();await page.getByRole("button",{name:"Power Budgets",exact:true}).click();await expect(page.getByLabel("Power budgets")).toContainText("1.8 W");await expect(page.getByLabel("Power budgets")).not.toContainText("99 W");
  await page.goto(focus);await page.getByRole("button",{name:"Check newer Item revision",exact:true}).click();await expect(page.getByText("Compare revision 1 → 2",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Keep saved revision",exact:true}).click();
  const saved=parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({where:{id:drawing.id}})).modelJson);const bom=await loadSelectedProductBom(saved,await listDrawingRenderSymbols([ioSymbol.versions[0].id,psSymbol.versions[0].id]));expect(bom.flatMap(b=>b.lines).filter(l=>l.itemId===device.id)).toHaveLength(1);expect(errors).toEqual([]);
});
