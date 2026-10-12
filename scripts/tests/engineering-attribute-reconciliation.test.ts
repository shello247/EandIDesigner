import {mkdirSync,mkdtempSync,copyFileSync,readFileSync} from "node:fs";
import path from "node:path";
import {PrismaClient} from "@prisma/client";
import {afterEach,expect,it} from "vitest";
import {ensureItemEngineeringStorage} from "../../src/features/item_engineering/api/server";
import {ATTRIBUTE_TYPE_SEEDS} from "../../src/features/engineering_attributes/api/public";
import {hashAttributeDefinition} from "../../src/features/engineering_attributes/data/type-storage";
import {previewEngineeringCatalogueUpgrade,applyEngineeringCatalogueUpgrade} from "../../src/features/engineering_attributes/api/server";
import {itemEngineeringUpgradeDatabaseUrl} from "../upgrade-item-engineering-storage";
import {reconcileEngineeringCatalogue} from "../engineering-attributes/reconcile-catalogue";
import {hashItemRevision} from "../../src/features/item_engineering/logic/services/item-engineering-revision";
const clients:PrismaClient[]=[];
async function fixture(){
  // Leave room for SQLite journal suffixes below Windows' native path limit.
  const base=path.resolve("artifacts/engineering-attributes/reconcile-tests");mkdirSync(base,{recursive:true});const dir=mkdtempSync(path.join(base,"run-"));const databasePath=path.join(dir,"fixture.db");const db=new PrismaClient({datasourceUrl:itemEngineeringUpgradeDatabaseUrl(databasePath)});clients.push(db);
  await db.$executeRawUnsafe("CREATE TABLE BomItem(id TEXT PRIMARY KEY)");await db.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY)");await db.$executeRawUnsafe("CREATE TABLE Drawing(id TEXT PRIMARY KEY, modelJson TEXT NOT NULL)");await db.$executeRawUnsafe("CREATE TABLE BomItemDocument(id TEXT PRIMARY KEY,itemId TEXT,title TEXT,fileName TEXT,mimeType TEXT,sizeBytes INTEGER,dataUrl TEXT,createdAt DATETIME,updatedAt DATETIME)");
  await ensureItemEngineeringStorage(db,{seedTypes:false});await db.$executeRawUnsafe("INSERT INTO Drawing VALUES('old','{\"version\":2,\"geometry\":\"unchanged\"}')");
  const seed=ATTRIBUTE_TYPE_SEEDS.find(t=>t.analysisKey==="length")!;const definitionJson=JSON.stringify(seed.definition);
  await db.engineeringAttributeType.create({data:{id:seed.typeId,name:seed.definition.label,normalizedName:seed.definition.label.toLowerCase(),analysisKey:seed.analysisKey,currentRevision:1,revisions:{create:{id:seed.revisionId,revisionNumber:1,definitionJson,contentHash:hashAttributeDefinition(definitionJson)}}}});
  return {db,databasePath,archiveBasePath:path.join(dir,"backups"),sourceCommit:"b".repeat(40)};
}
afterEach(async()=>{await Promise.all(clients.splice(0).map(db=>db.$disconnect()));});
it("previews without writes, adds immutable unit revisions, preserves drawings, and is idempotent",async()=>{
  const f=await fixture();const old=await f.db.engineeringAttributeTypeRevision.findMany();const preview=await reconcileEngineeringCatalogue({...f,apply:false});expect(preview.status).toBe("preview");expect(await f.db.engineeringAttributeTypeRevision.findMany()).toEqual(old);
  const result=await reconcileEngineeringCatalogue({...f,apply:true});expect(result.status).toBe("upgraded");if(result.status!=="upgraded")throw new Error("Fixture");
  expect(await f.db.engineeringAttributeTypeRevision.findUnique({where:{id:old[0].id}})).toEqual(old[0]);const current=await f.db.engineeringAttributeTypeRevision.findFirst({where:{typeId:old[0].typeId},orderBy:{revisionNumber:"desc"}});expect(JSON.parse(current!.definitionJson).allowedUnits).toEqual(expect.arrayContaining(["in","ft"]));
  expect((await reconcileEngineeringCatalogue({...f,apply:true})).status).toBe("current");
  const receipt=JSON.parse(readFileSync(path.join(result.archive,"receipt.json"),"utf8"));expect(receipt.before.Drawing).toEqual(receipt.after.Drawing);
  const restoredPath=path.join(path.dirname(f.databasePath),"restored.db");copyFileSync(path.join(result.archive,"pre-catalogue-upgrade.db"),restoredPath);const restored=new PrismaClient({datasourceUrl:itemEngineeringUpgradeDatabaseUrl(restoredPath)});clients.push(restored);expect(await restored.engineeringAttributeTypeRevision.findMany()).toEqual(old);expect(await restored.$queryRawUnsafe("SELECT * FROM Drawing")).toEqual(await f.db.$queryRawUnsafe("SELECT * FROM Drawing"));
},30000);
it("refuses a stale preview and preserves an ambiguous source-backed legacy text revision",async()=>{
  const f=await fixture();const plan=await previewEngineeringCatalogueUpgrade(f.db);await f.db.engineeringAttributeType.update({where:{id:"attribute_type_length"},data:{status:"retired"}});await expect(applyEngineeringCatalogueUpgrade(f.db,plan.fingerprint)).rejects.toThrow("changed after preview");
  const identity={itemKey:"fixture",displayName:"Synthetic legacy module",manufacturer:null,model:null,partNumber:null};
  const type={...ATTRIBUTE_TYPE_SEEDS.find(t=>t.analysisKey==="network_protocol")!,typeId:"custom-temperature",analysisKey:null,definition:{label:"Operating temperature",description:"Synthetic legacy description",category:"documentation",valueKind:"text",payloadKind:"scalar",maximumTextLength:400}};
  const profile={version:2,deviceType:"io_module",groups:[{key:"device",label:"Old group",context:"device"}],entries:[{id:"legacy-temp",groupKey:"device",title:"Operating temperature",description:"",type,payload:{kind:"text",value:"Depends on installation"},source:{kind:"manufacturer",reference:"Synthetic old manual"}}]};
  const contentHash=hashItemRevision({identity,profile:profile as Parameters<typeof hashItemRevision>[0]["profile"],notes:[],documents:[]});await f.db.$executeRawUnsafe("INSERT INTO BomItem VALUES('legacy')");await f.db.$executeRawUnsafe("INSERT INTO BomItemEngineeringRevision(id,itemId,revisionNumber,identityJson,profileJson,contentHash) VALUES(?,?,?,?,?,?)","legacy-r1","legacy",1,JSON.stringify(identity),JSON.stringify(profile),contentHash);
  const before=await f.db.$queryRawUnsafe("SELECT * FROM BomItemEngineeringRevision");const preview=await reconcileEngineeringCatalogue({...f,apply:false});expect(preview.status).toBe("preview");if(preview.status!=="preview")throw new Error("Fixture");expect(preview.records[0].proposals[0].status).toBe("needs_review");expect(await f.db.$queryRawUnsafe("SELECT * FROM BomItemEngineeringRevision")).toEqual(before);
});
