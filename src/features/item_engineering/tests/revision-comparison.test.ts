import {expect,it} from "vitest";
import type {ItemEngineeringRevision} from "../api/public";
import {compareProductRevisions} from "../logic/services/compare-product-revisions";
it("compares exact values and interface changes without changing either snapshot",()=>{
  const before:ItemEngineeringRevision={id:"r1",itemId:"item",revisionNumber:1,identity:{itemKey:"item",displayName:"Product",manufacturer:null,model:null,partNumber:null},profile:{version:3,deviceType:"io_module",groups:[],modes:[],entries:[],channels:[],terminals:[]},noteIds:[],documentIds:[],contentHash:"a".repeat(64),createdAt:"2026-09-18T00:00:00.000Z"};
  const after=structuredClone(before);after.id="r2";after.revisionNumber=2;after.identity.partNumber="Exact model";after.documentIds=["doc"];if(after.profile.version!==3)throw new Error("Fixture");after.profile.terminals.push({id:"t1",number:"1",function:"Positive",connectable:true,shared:false,evidence:[]});
  const old=JSON.stringify(before);const current=JSON.stringify(after);
  expect(compareProductRevisions(before,after).map(c=>c.label)).toEqual(["partNumber","terminals","Retained sources"]);
  expect(JSON.stringify(before)).toBe(old);expect(JSON.stringify(after)).toBe(current);
});
