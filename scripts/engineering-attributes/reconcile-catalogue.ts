import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from "node:fs";
import net from "node:net";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {PrismaClient} from "@prisma/client";
import {previewEngineeringCatalogueUpgrade,applyEngineeringCatalogueUpgrade} from "../../src/features/engineering_attributes/api/server";
import {ATTRIBUTE_TYPE_SEEDS} from "../../src/features/engineering_attributes/api/public";
import {getItemEngineeringRevisions} from "../../src/features/item_engineering/api/server";
import {projectItemProfileV3} from "../../src/features/item_engineering/api/public";
import {previewCatalogueReconciliation} from "../../src/features/item_engineering/logic/services/catalogue-reconciliation";
import {findCanonicalMainWorktree,parseGitWorktreeList} from "../development-runtime";
import {itemEngineeringUpgradeDatabaseUrl} from "../upgrade-item-engineering-storage";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const workspace=path.resolve(root,"../../..");
const stringify=(value:unknown)=>JSON.stringify(value,(_key,v)=>typeof v==="bigint"?v.toString():v);
const hash=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const quote=(name:string)=>`"${name.replaceAll('"','""')}"`;
function guard(target:string){
  const resolved=path.resolve(target);const relative=path.relative(workspace,resolved);if(relative.startsWith("..")||path.isAbsolute(relative))throw new Error("Storage must remain in the EI workspace.");
  let ancestor=resolved;while(!existsSync(ancestor)){const next=path.dirname(ancestor);if(next===ancestor)throw new Error("Invalid path");ancestor=next;}
  if(realpathSync(ancestor).toLowerCase()!==ancestor.toLowerCase())throw new Error("Redirected storage is not allowed.");return resolved;
}
async function inventory(db:PrismaClient){
  const tables=await db.$queryRawUnsafe<Array<{name:string}>>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const result:Record<string,string[]>={};
  for(const table of tables){const rows=await db.$queryRawUnsafe<Array<Record<string,unknown>>>(`SELECT * FROM ${quote(table.name)}`);
    result[table.name]=rows.map(row=>{if(table.name==="EngineeringAttributeType"){const retained={...row};delete retained.currentRevision;delete retained.updatedAt;return hash(stringify(retained));}return hash(stringify(row));}).sort();}
  return result;
}
export async function previewRecordReconciliation(db:PrismaClient){
  const latest=await db.$queryRawUnsafe<Array<{id:string}>>('SELECT r.id FROM BomItemEngineeringRevision r WHERE r.revisionNumber=(SELECT MAX(r2.revisionNumber) FROM BomItemEngineeringRevision r2 WHERE r2.itemId=r.itemId) ORDER BY r.id');
  const results=[];
  for(let offset=0;offset<latest.length;offset+=250){const revisions=await getItemEngineeringRevisions(latest.slice(offset,offset+250).map(r=>r.id),db);
    for(const revision of revisions){const profile=projectItemProfileV3(revision.profile);const replacements:Record<string,(typeof ATTRIBUTE_TYPE_SEEDS)[number]>={};
      for(const entry of profile.entries){const label=entry.type.definition.label.toLowerCase();const key=label==="operating temperature"?"operating_temperature_range":label==="storage temperature"?"storage_temperature_range":undefined;
        if(key)replacements[entry.type.typeId]=ATTRIBUTE_TYPE_SEEDS.find(t=>t.analysisKey===key)!;}
      const proposals=previewCatalogueReconciliation(profile.entries,replacements);if(proposals.length)results.push({itemId:revision.itemId,revisionId:revision.id,contentHash:revision.contentHash,proposals});}
  }
  return results;
}
export async function reconcileEngineeringCatalogue(input:{db:PrismaClient;databasePath:string;archiveBasePath:string;apply:boolean;sourceCommit:string}){
  const databasePath=guard(input.databasePath);const archiveBasePath=guard(input.archiveBasePath);
  const connected=await input.db.$queryRawUnsafe<Array<{name:string;file:string}>>("PRAGMA database_list");
  if(!connected.some(r=>r.name==="main"&&realpathSync(r.file).toLowerCase()===realpathSync(databasePath).toLowerCase()))throw new Error("Substitute database connection refused.");
  await input.db.$queryRawUnsafe("PRAGMA busy_timeout=0");await input.db.$queryRawUnsafe("PRAGMA locking_mode=EXCLUSIVE");await input.db.$executeRawUnsafe("BEGIN EXCLUSIVE");await input.db.$executeRawUnsafe("COMMIT");
  const plan=await previewEngineeringCatalogueUpgrade(input.db);const records=await previewRecordReconciliation(input.db);
  if(!input.apply)return {status:"preview" as const,plan,records};
  if(!/^[a-f0-9]{40}$/.test(input.sourceCommit))throw new Error("A committed source identity is required.");
  if(!plan.proposals.length)return {status:"current" as const,plan,records};
  const archive=guard(path.join(archiveBasePath,`${new Date().toISOString().replace(/[:.]/g,"-")}-${input.sourceCommit.slice(0,12)}`));mkdirSync(archive,{recursive:true});
  const before=await inventory(input.db);const backupPath=guard(path.join(archive,"pre-catalogue-upgrade.db"));
  await input.db.$executeRawUnsafe(`VACUUM INTO '${backupPath.replaceAll("\\","/").replaceAll("'","''")}'`);
  const backupHash=hash(readFileSync(backupPath));const backup=new PrismaClient({datasourceUrl:itemEngineeringUpgradeDatabaseUrl(backupPath)});
  try{const integrity=await backup.$queryRawUnsafe<Array<{integrity_check:string}>>("PRAGMA integrity_check");if(integrity.length!==1||integrity[0].integrity_check!=="ok"||stringify(await inventory(backup))!==stringify(before))throw new Error("Catalogue backup verification failed.");}finally{await backup.$disconnect();}
  const receipt={sourceCommit:input.sourceCommit,databasePath,backupPath,backupHash,plan,records,before:Object.fromEntries(Object.entries(before).map(([name,rows])=>[name,{count:rows.length,hash:hash(stringify(rows))}]))};
  writeFileSync(guard(path.join(archive,"preview.json")),JSON.stringify(receipt,null,2),{flag:"wx"});
  const applied=await applyEngineeringCatalogueUpgrade(input.db,plan.fingerprint);const after=await inventory(input.db);
  for(const [table,rows] of Object.entries(before)){
    if(["EngineeringAttributeType","EngineeringAttributeTypeRevision"].includes(table)){const counts=new Map<string,number>();for(const value of after[table]??[])counts.set(value,(counts.get(value)??0)+1);for(const value of rows){const count=counts.get(value)??0;if(!count)throw new Error(`Preservation check failed: ${table}`);counts.set(value,count-1);}}
    else if(stringify(rows)!==stringify(after[table]))throw new Error(`Unrelated records changed: ${table}`);
  }
  const next=await previewEngineeringCatalogueUpgrade(input.db);if(next.proposals.length)throw new Error("Catalogue upgrade was not idempotent.");
  writeFileSync(guard(path.join(archive,"receipt.json")),JSON.stringify({...receipt,applied,state:"upgraded-and-preserved",after:Object.fromEntries(Object.entries(after).map(([name,rows])=>[name,{count:rows.length,hash:hash(stringify(rows))}]))},null,2),{flag:"wx"});
  return {status:"upgraded" as const,archive,backupHash,applied,recordReviewCount:records.length};
}
async function main(){
  const args=process.argv.slice(2);if(args.length>1||args.some(a=>a!=="--apply"))throw new Error("Only --apply is accepted; database overrides are not supported.");
  if(JSON.parse(readFileSync(path.join(root,"package.json"),"utf8")).name!=="ei-designer"||!existsSync(path.join(workspace,".ei-workspace-root")))throw new Error("Invalid application workspace.");
  const trees=parseGitWorktreeList(execFileSync("git",["-C",root,"worktree","list","--porcelain"],{encoding:"utf8"}));const canonical=findCanonicalMainWorktree(trees);
  if(path.resolve(canonical.path)!==path.join(workspace,"Application Folders/Main Application/EI_Designer"))throw new Error("Canonical target mismatch.");
  await new Promise<void>((resolve,reject)=>{const probe=net.createServer();probe.once("error",()=>reject(new Error("Stop port 3000 before catalogue maintenance.")));probe.listen(3000,"127.0.0.1",()=>probe.close(error=>error?reject(error):resolve()));});
  const databasePath=guard(path.join(canonical.path,"prisma/dev.db"));const db=new PrismaClient({datasourceUrl:itemEngineeringUpgradeDatabaseUrl(databasePath)});
  try{const result=await reconcileEngineeringCatalogue({db,databasePath,archiveBasePath:path.join(root,"artifacts/engineering-attributes/catalogue-upgrades"),sourceCommit:execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),apply:args.includes("--apply")});
    const report=guard(path.join(root,"artifacts/engineering-attributes/catalogue-preview.json"));mkdirSync(path.dirname(report),{recursive:true});writeFileSync(report,JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,report,...("applied" in result?{applied:result.applied}:{proposalCount:result.plan.proposals.length,reviewCount:result.plan.needsReview.length,recordReviewCount:result.records.length})}));
  }finally{await db.$disconnect();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))void main().catch(error=>{console.error(error);process.exitCode=1;});
