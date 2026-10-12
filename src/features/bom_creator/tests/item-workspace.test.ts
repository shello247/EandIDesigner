import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { displayItemValue, formatSavedUnitCost, formatRecordedQuantity, formatItemDocumentSize, formatItemUsageQuantity, itemContactHref } from "../logic/services/item-workspace-presentation";
import { ensureItemEngineeringStorage, getLatestItemEngineeringRevision, saveItemEngineerNote } from "@/features/item_engineering/api/server";
import { saveItemWorkspaceProfile } from "@/features/item_engineering/data/mutations";
import { getItemWorkspaceOverview, itemDetailsFieldsSchema, itemDetailsUpdateSchema, itemCommercialFieldsSchema, updateItemWorkspaceDetails, updateItemWorkspaceCommercial } from "../data/item-workspace";
const clients: PrismaClient[] = [];
describe("Item workspace presentation", () => {
  it("shows readable Mini BOM quantity rules while preserving zero and fractional values", () => {
    expect(formatItemUsageQuantity(1, "fixed_per_assembly")).toBe("Qty 1 · Per assembly");
    expect(formatItemUsageQuantity(0.25, "per_cable_end")).toBe("Qty 0.25 · Per cable end");
    expect(formatItemUsageQuantity(2, "per_conductor_termination")).toBe("Qty 2 · Per conductor termination");
    expect(formatItemUsageQuantity(3, "per_connection")).toBe("Qty 3 · Per connection");
    expect(formatItemUsageQuantity(0, "manual")).toBe("Qty 0 · Manual");
  });
  it("shows useful attachment sizes without rounding a small PDF down to zero MB", () => {
    expect(formatItemDocumentSize(51)).toBe("51 B"); expect(formatItemDocumentSize(1024)).toBe("1 KB");
    expect(formatItemDocumentSize(1536)).toBe("1.5 KB"); expect(formatItemDocumentSize(1024 * 1024)).toBe("1 MB");
  });
  it("preserves missing values, zeros and fractional quantities without inferring units or currency", () => {
    expect(displayItemValue(" ")).toBe("Unspecified"); expect(displayItemValue(0)).toBe("0");
    expect(formatSavedUnitCost(undefined, "USD")).toBe("Unspecified");
    expect(formatSavedUnitCost(0, "USD")).toBe("USD 0.00");
    expect(formatSavedUnitCost(100.58, "USD")).toBe("USD 100.58");
    expect(formatSavedUnitCost(2, " ")).toBe("Currency unspecified 2.00");
    expect(formatSavedUnitCost(2, "Legacy currency")).toBe("Legacy currency 2.00");
    expect(formatRecordedQuantity(0, " days")).toBe("0 days");
    expect(formatRecordedQuantity(0.25)).toBe("0.25"); expect(formatRecordedQuantity(null)).toBe("Unspecified");
  });
  it("makes valid contact values actionable without activating unsafe or invalid legacy text", () => {
    expect(itemContactHref("website", "www.mouser.com")).toBe("https://www.mouser.com/");
    expect(itemContactHref("website", "http://example.com/path")).toBe("http://example.com/path");
    for (const value of ["javascript:alert(1)", "data:text/html,hello", "https://user:password@example.com", "not a website", "https://example.com\npath", "ftp://example.com", "https://"]) expect(itemContactHref("website", value)).toBeNull();
    expect(itemContactHref("email", "sales@mouser.com")).toBe("mailto:sales@mouser.com");
    expect(itemContactHref("email", "sales@example.com?subject=Injected")).toBeNull();
    expect(itemContactHref("phone", "(800) 346-6873")).toBe("tel:8003466873");
    expect(itemContactHref("phone", "+1 (868) 555-1234")).toBe("tel:+18685551234");
    expect(itemContactHref("phone", "Call sales")).toBeNull(); expect(itemContactHref("phone", "12")).toBeNull();
  });
});
async function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root,"package.json"),"utf8")).name !== "ei-designer") throw new Error("Wrong application");
  const base=path.join(root,"artifacts/drawing-performance/item-engineering/workspace-tests");
  mkdirSync(base,{recursive:true}); if(realpathSync(base)!==base)throw new Error("Redirected fixture");
  const file=path.join(mkdtempSync(path.join(base,"run-")),"fixture.db");
  const db=new PrismaClient({datasourceUrl:"file:"+file.replaceAll("\\","/")});clients.push(db);
  const bootstrap=readFileSync(path.join(root,"scripts/bootstrap-sqlite.ts"),"utf8");
  for(const table of ["BomItem","BomItemImage","BomItemDocument"]) {
    const start=bootstrap.indexOf('CREATE TABLE IF NOT EXISTS "'+table+'"');
    const end=bootstrap.indexOf(");",start);
    if(start<0||end<0)throw new Error("Bootstrap schema missing");
    await db.$executeRawUnsafe(bootstrap.slice(start,end+2));
  }
  await db.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY)");
  await ensureItemEngineeringStorage(db);
  await db.bomItem.create({data:{id:"item-a",itemKey:"BOM-TEST",displayName:"Test breaker",category:"accessory",unit:"each",status:"active",notes:"General note",supplierName:"Original supplier"}});
  return db;
}
afterEach(async()=>{await Promise.all(clients.splice(0).map(db=>db.$disconnect()));});
describe("Item workspace field-scoped persistence",()=>{
  it("reads unclassified legacy Items without guessing from catalogue text or writing a profile",async()=>{
    const db=await fixture();
    for(const category of ["accessory","panel","plc","breaker"]) {
      await db.bomItem.update({where:{id:"item-a"},data:{category}});
      const original=await db.bomItem.findUniqueOrThrow({where:{id:"item-a"}});
      const overview=(await getItemWorkspaceOverview("item-a",db))!;
      expect(overview.deviceType).toBeNull();expect(overview.category).toBe(category);
      expect(overview.revisionId).toBeNull();
      expect(await db.bomItem.findUniqueOrThrow({where:{id:"item-a"}})).toEqual(original);
    }
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
  });
  it("uses the saved engineering profile as the single type without silently rewriting a mismatched legacy category",async()=>{
    const db=await fixture();
    const first=await saveItemWorkspaceProfile({itemId:"item-a",expectedLatestRevisionId:null,profile:{version:1,deviceType:"breaker",groups:[],terminalConductorRanges:[]}},db);
    await db.bomItem.update({where:{id:"item-a"},data:{category:"legacy-protection"}});
    const original=await db.bomItem.findUniqueOrThrow({where:{id:"item-a"}});
    const overview=(await getItemWorkspaceOverview("item-a",db))!;
    expect(overview.deviceType).toBe("breaker");expect(overview.category).toBe("legacy-protection");
    expect(await db.bomItem.findUniqueOrThrow({where:{id:"item-a"}})).toEqual(original);
    expect(await getLatestItemEngineeringRevision("item-a",db)).toEqual(first.revision);
  });
  it("requires a controlled Device Type and rejects separately submitted catalogue categories",async()=>{
    const db=await fixture();const initial=(await getItemWorkspaceOverview("item-a",db))!;
    const fields=Object.fromEntries(Object.keys(itemDetailsFieldsSchema.shape).map(key=>[key,initial[key as keyof typeof initial]]));
    const input={itemId:"item-a",expectedUpdatedAt:initial.updatedAt,expectedLatestRevisionId:null,fields};
    expect(itemDetailsUpdateSchema.safeParse(input).success).toBe(false);
    for(const deviceType of [null,"","Circuit Breaker","accessory"]) {
      expect(itemDetailsUpdateSchema.safeParse({...input,deviceType}).success).toBe(false);
    }
    expect(itemDetailsUpdateSchema.safeParse({...input,deviceType:"breaker"}).success).toBe(true);
    await expect(updateItemWorkspaceDetails({...input,deviceType:"breaker",fields:{...fields,category:"accessory"}},db)).rejects.toThrow();
    expect((await getItemWorkspaceOverview("item-a",db))!.updatedAt).toBe(initial.updatedAt);
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
  });
  it("keeps purchasing independent of identity, specifications and guidance",async()=>{
    const db=await fixture();
    const profile=await saveItemWorkspaceProfile({itemId:"item-a",expectedLatestRevisionId:null,profile:{version:1,deviceType:"breaker",groups:[],terminalConductorRanges:[]}},db);
    const initial=(await getItemWorkspaceOverview("item-a",db))!;
    expect(JSON.stringify(initial)).not.toContain("profile");
    expect(initial).not.toHaveProperty("documents");
    expect(initial).not.toHaveProperty("usage");
    const updated=await updateItemWorkspaceCommercial({itemId:"item-a",expectedUpdatedAt:initial.updatedAt,
      fields:{...Object.fromEntries(Object.keys(itemCommercialFieldsSchema.shape).map(key=>[key,initial[key as keyof typeof initial]])),supplierName:"New supplier",unitCost:0}},db);
    expect(updated.displayName).toBe(initial.displayName);expect(updated.notes).toBe("General note");
    expect(updated.unitCost).toBe(0);
    expect(await getLatestItemEngineeringRevision("item-a",db)).toEqual(profile.revision);
    await expect(updateItemWorkspaceCommercial({itemId:"item-a",expectedUpdatedAt:initial.updatedAt,fields:{supplierName:"stale"}},db)).rejects.toMatchObject({code:"REVISION_CONFLICT"});
  });
  it("rejects archived edits and unexpected cross-section fields; retains commercial data on identity edits",async()=>{
    const db=await fixture();const initial=(await getItemWorkspaceOverview("item-a",db))!;
    const details=Object.fromEntries(Object.keys(itemDetailsFieldsSchema.shape).map(key=>[key,initial[key as keyof typeof initial]]));
    const updated=await updateItemWorkspaceDetails({itemId:"item-a",expectedUpdatedAt:initial.updatedAt,expectedLatestRevisionId:null,deviceType:"breaker",fields:{...details,displayName:"Renamed"}},db);
    expect(updated.supplierName).toBe("Original supplier");expect(updated.revisionId).not.toBeNull();
    expect(updated.category).toBe("breaker");expect(updated.deviceType).toBe("breaker");
    await expect(updateItemWorkspaceCommercial({itemId:"item-a",expectedUpdatedAt:updated.updatedAt,fields:{displayName:"Bypass"}} ,db)).rejects.toThrow();
    await db.bomItem.update({where:{id:"item-a"},data:{status:"archived"}});
    await expect(updateItemWorkspaceDetails({itemId:"item-a",expectedUpdatedAt:updated.updatedAt,expectedLatestRevisionId:updated.revisionId,deviceType:"breaker",fields:details},db)).rejects.toMatchObject({code:"ARCHIVED"});
    expect((await getItemWorkspaceOverview("item-a",db))!.displayName).toBe("Renamed");
  });
  it("saves identity and the first classification as one revision with existing guidance",async()=>{
    const db=await fixture();
    const note=await saveItemEngineerNote({itemId:"item-a",expectedLatestRevisionId:null,notes:"Existing installation guidance",image:null},db);
    const document=await db.bomItemDocument.create({data:{itemId:"item-a",title:"Existing document",fileName:"datasheet.pdf",mimeType:"application/pdf",sizeBytes:4,dataUrl:"data:application/pdf;base64,dGVzdA=="}});
    const initial=(await getItemWorkspaceOverview("item-a",db))!;
    expect(initial.deviceType).toBeNull();
    const fields=Object.fromEntries(Object.keys(itemDetailsFieldsSchema.shape).map(key=>[key,initial[key as keyof typeof initial]]));
    const saved=await updateItemWorkspaceDetails({itemId:"item-a",expectedUpdatedAt:initial.updatedAt,expectedLatestRevisionId:null,
      deviceType:"breaker",fields:{...fields,displayName:"Configured breaker",manufacturer:"Test manufacturer"}},db);
    const revision=(await getLatestItemEngineeringRevision("item-a",db))!;
    expect(saved.deviceType).toBe("breaker");expect(saved.category).toBe("breaker");expect(saved.revisionId).toBe(revision.id);
    expect(revision.identity).toMatchObject({displayName:"Configured breaker",manufacturer:"Test manufacturer"});
    expect(revision.profile.deviceType).toBe("breaker");
    expect(revision.noteIds).toEqual([note.note.id]);expect(revision.documentIds).toEqual([document.id]);
    expect(await db.bomItemEngineeringRevision.count()).toBe(1);
    expect(saved.supplierName).toBe(initial.supplierName);expect(saved.notes).toBe(initial.notes);
  });
  it("combines identity and compatible classification changes without losing specifications or history",async()=>{
    const db=await fixture();
    const first=await saveItemWorkspaceProfile({itemId:"item-a",expectedLatestRevisionId:null,profile:{version:1,deviceType:"other",
      groups:[{key:"device",label:"Device",context:"device",attributes:{version:1,values:[{
        definitionKey:"physical_width",definitionVersion:1,kind:"quantity",value:52.5,unit:"mm",source:{kind:"manufacturer",reference:"Datasheet"}
      }]}}],terminalConductorRanges:[]}},db);
    const historical=await db.bomItemEngineeringRevision.findUniqueOrThrow({where:{id:first.revision.id}});
    const initial=(await getItemWorkspaceOverview("item-a",db))!;
    const fields=Object.fromEntries(Object.keys(itemDetailsFieldsSchema.shape).map(key=>[key,initial[key as keyof typeof initial]]));
    const saved=await updateItemWorkspaceDetails({itemId:"item-a",expectedUpdatedAt:initial.updatedAt,expectedLatestRevisionId:first.revision.id,
      deviceType:"breaker",fields:{...fields,displayName:"Specified breaker"}},db);
    const latest=(await getLatestItemEngineeringRevision("item-a",db))!;
    expect(latest.revisionNumber).toBe(2);expect(saved.revisionId).toBe(latest.id);
    expect(latest.identity.displayName).toBe("Specified breaker");
    expect(latest.profile).toMatchObject({version:3,deviceType:"breaker",entries:[{payload:{kind:"quantity",value:52.5,unit:"mm"},source:{kind:"manufacturer",reference:"Datasheet"}}]});
    expect(await db.bomItemEngineeringRevision.findUniqueOrThrow({where:{id:first.revision.id}})).toEqual(historical);
  });
  it("allows an atypical classification while retaining specifications and history",async()=>{
    const db=await fixture();
    const first=await saveItemWorkspaceProfile({itemId:"item-a",expectedLatestRevisionId:null,profile:{version:1,deviceType:"breaker",
      groups:[{key:"device",label:"Device",context:"device",attributes:{version:1,values:[{
        definitionKey:"pole_count",definitionVersion:1,kind:"number",value:3,source:{kind:"manufacturer"}
      }]}}],terminalConductorRanges:[]}},db);
    const historical=await db.bomItemEngineeringRevision.findUniqueOrThrow({where:{id:first.revision.id}});
    const initial=(await getItemWorkspaceOverview("item-a",db))!;
    const fields=Object.fromEntries(Object.keys(itemDetailsFieldsSchema.shape).map(key=>[key,initial[key as keyof typeof initial]]));
    const saved=await updateItemWorkspaceDetails({itemId:"item-a",expectedUpdatedAt:initial.updatedAt,expectedLatestRevisionId:first.revision.id,
      deviceType:"instrument",fields:{...fields,displayName:"Reviewed atypical device"}},db);
    expect(saved.deviceType).toBe("instrument");
    expect((await getLatestItemEngineeringRevision("item-a",db))!.profile).toMatchObject({version:3,deviceType:"instrument",entries:[{payload:{kind:"number",value:3}}]});
    expect(await db.bomItemEngineeringRevision.findUniqueOrThrow({where:{id:first.revision.id}})).toEqual(historical);
    expect(await db.bomItemEngineeringRevision.count()).toBe(2);
  });
  it("rejects a stale engineering token without applying details or detaching newer guidance",async()=>{
    const db=await fixture();
    const first=await saveItemWorkspaceProfile({itemId:"item-a",expectedLatestRevisionId:null,profile:{version:1,deviceType:"breaker",groups:[],terminalConductorRanges:[]}},db);
    const initial=(await getItemWorkspaceOverview("item-a",db))!;
    const note=await saveItemEngineerNote({itemId:"item-a",expectedLatestRevisionId:first.revision.id,notes:"Added in another tab",image:null},db);
    const original=await db.bomItem.findUniqueOrThrow({where:{id:"item-a"}});
    const fields=Object.fromEntries(Object.keys(itemDetailsFieldsSchema.shape).map(key=>[key,initial[key as keyof typeof initial]]));
    await expect(updateItemWorkspaceDetails({itemId:"item-a",expectedUpdatedAt:initial.updatedAt,expectedLatestRevisionId:first.revision.id,
      deviceType:"power_supply",fields:{...fields,displayName:"Stale details"}},db)).rejects.toMatchObject({code:"REVISION_CONFLICT"});
    expect(await db.bomItem.findUniqueOrThrow({where:{id:"item-a"}})).toEqual(original);
    expect(await getLatestItemEngineeringRevision("item-a",db)).toEqual(note.revision);
    expect(await db.bomItemEngineeringRevision.count()).toBe(2);
  });
});
