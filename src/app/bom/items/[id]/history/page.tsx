import Link from "next/link";
import {notFound} from "next/navigation";
import {getItemWorkspaceOverview} from "@/features/bom_creator/api/public";
import {listItemEngineeringHistory} from "@/features/item_engineering/api/server";
export const dynamic="force-dynamic";
export default async function ItemHistoryPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){
  const {id}=await params;const {page}=await searchParams;const item=await getItemWorkspaceOverview(id);if(!item)notFound();
  const history=await listItemEngineeringHistory(id,Number(page)||1);
  return <main className="mx-auto max-w-4xl space-y-4 p-5"><Link className="text-teal-700 underline" href={`/bom/items/${id}`}>Back to Item</Link><h1 className="text-xl font-semibold">{item.displayName} · Engineering history</h1>
    <p className="text-sm text-slate-600">Each revision retains its specifications, connection definitions and cited source identities. Opening a revision does not change the current Item.</p>
    <ul className="divide-y rounded border bg-white">{history.rows.map(row=><li key={row.id} className="p-3"><Link className="text-teal-700 underline" href={`/bom/items/${id}?revisionId=${row.id}`}>Revision {row.revisionNumber}</Link><span className="ml-3 text-sm text-slate-500">{row.createdAt.replace("T"," ").slice(0,19)} UTC</span></li>)}</ul>
    {!history.total&&<p>No engineering revisions saved yet.</p>}<nav className="flex gap-4 text-sm">{history.page>1&&<Link href={`?page=${history.page-1}`}>Previous</Link>}{history.page*25<history.total&&<Link href={`?page=${history.page+1}`}>Next</Link>}</nav></main>;
}
