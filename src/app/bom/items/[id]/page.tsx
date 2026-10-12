import { notFound } from "next/navigation";
import { getItemWorkspaceOverview } from "@/features/bom_creator/api/public";
import { BomItemWorkspace } from "@/features/bom_creator/ui/public";
import Link from "next/link";
import {getItemEngineeringRevision} from "@/features/item_engineering/api/server";
import {InheritedSpecifications} from "@/features/item_engineering/ui/components/inherited-specifications";

export const dynamic = "force-dynamic";

export default async function BomItemDetailPage({
  params,searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams:Promise<{revisionId?:string}>;
}) {
  const { id } = await params;
  const {revisionId}=await searchParams;
  if(revisionId){
    const revision=await getItemEngineeringRevision(revisionId);
    if(!revision||revision.itemId!==id)notFound();
    return <main className="mx-auto max-w-4xl space-y-4 p-5"><Link className="text-sm text-teal-700 underline" href={`/bom/items/${id}`}>Open current Item</Link><h1 className="text-xl font-semibold">{revision.identity.displayName} · Revision {revision.revisionNumber}</h1><p className="text-sm text-slate-600">Historical engineering snapshot · {revision.createdAt.slice(0,10)} · read-only</p><InheritedSpecifications revision={revision}/><Link className="text-sm text-teal-700 underline" href={`/bom/items/${id}/history`}>Revision history</Link></main>;
  }
  const item = await getItemWorkspaceOverview(id);

  if (!item) {
    notFound();
  }

  return <BomItemWorkspace key={item.id} item={item} />;
}
