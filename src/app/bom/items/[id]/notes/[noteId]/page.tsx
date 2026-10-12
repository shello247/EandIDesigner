import Link from "next/link";
import {notFound} from "next/navigation";
import {getItemEngineerNote} from "@/features/item_engineering/api/server";
export const dynamic="force-dynamic";
export default async function RetainedNotePage({params}:{params:Promise<{id:string;noteId:string}>}){
  const {id,noteId}=await params;const note=await getItemEngineerNote(id,noteId);if(!note)notFound();
  return <main className="mx-auto max-w-4xl space-y-4 p-5"><Link className="text-teal-700 underline" href={`/bom/items/${id}`}>Open Item</Link><h1 className="text-xl font-semibold">Retained engineer note</h1><p className="text-sm text-slate-600">{note.archivedAt?"Archived source · ":""}Original content · {note.createdAt.slice(0,10)}</p><p className="whitespace-pre-wrap rounded border bg-white p-4">{note.notes}</p>
    {note.image&&<div className="rounded border bg-white p-3">{/* Source image is loaded only on explicit source navigation. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={note.image.fileName} src={note.image.dataUrl} className="h-auto max-w-full"/></div>}</main>;
}
