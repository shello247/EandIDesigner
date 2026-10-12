"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { ItemWorkspaceMessage, readItemImage, useItemSectionDraft, useItemWorkspace } from "@/features/item_engineering/ui/public";
import { loadItemWorkspaceOverviewAction, saveItemImagesAction } from "../../api/item-workspace-actions";
import type { ItemOverview } from "../../data/item-workspace";
import type { BomItemImageWriteInput } from "../../data/schema";
import { MAX_BOM_ITEM_IMAGES, validateBomItemImageBudget } from "../../logic/services/bom-item-image-budget";
import { BomItemImageView } from "./bom-item-image-view";

type ImageDraft = { key: string; image: BomItemImageWriteInput };
const imageDrafts = (item: ItemOverview): ImageDraft[] => item.images.map(image => ({
  key: image.id,
  image: { kind: "existing", id: image.id, caption: image.caption, isPrimary: image.isPrimary, sortOrder: image.sortOrder }
}));

export function ItemImagesDialog({ item, onUpdated, onClose }: {
  item: ItemOverview; onUpdated: (item: ItemOverview) => void; onClose: () => void;
}) {
  const [initial] = useState(() => imageDrafts(item));
  const draft = useItemSectionDraft("images", initial);
  const { readOnly, busy, mutate, reviewRevision, setDirty } = useItemWorkspace();
  const [readingImage, setReadingImage] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"info" | "error">("error");
  const [conflict, setConflict] = useState(false);
  const [review, setReview] = useState<ItemOverview | null>(null);
  const currentItem = useRef(item);
  const active = useRef(true);
  const uploadInput = useRef<HTMLInputElement>(null);
  const locked = busy || readingImage || reviewing;

  useLayoutEffect(() => { currentItem.current = item; }, [item]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; setDirty("images", false); };
  }, [setDirty]);

  const close = () => {
    if (locked) return;
    if (!draft.dirty || window.confirm("Discard unsaved changes to this entry?")) onClose();
  };
  const changeCaption = (key: string, caption: string) => {
    draft.change(draft.snapshot().map(entry => entry.key === key ? { ...entry, image: { ...entry.image, caption } } : entry));
  };
  const addImage = async (file: File) => {
    if (locked || readOnly) return;
    setReadingImage(true); setMessage(null); setMessageKind("error");
    try {
      const image = await readItemImage(file);
      if (!active.current) return;
      const current = draft.snapshot();
      const budget = validateBomItemImageBudget([
        ...current.map(entry => {
          const existing = entry.image;
          return existing.kind === "new" ? existing : {
            sizeBytes: currentItem.current.images.find(saved => saved.id === existing.id)?.sizeBytes ?? 0
          };
        }), image
      ]);
      if (!budget.ok) throw new Error(budget.violations.map(violation => violation.message).join(" "));
      draft.change([...current, { key: crypto.randomUUID(), image: { ...image, kind: "new", isPrimary: current.length === 0, sortOrder: current.length } }]);
    } catch (error) {
      if (active.current) setMessage(error instanceof Error ? error.message : "The image could not be read. Please retry.");
    } finally {
      if (active.current) setReadingImage(false);
    }
  };
  const save = async () => {
    if (locked || readOnly || conflict || !draft.dirty) return;
    const submitted = draft.snapshot();
    setMessage(null); setMessageKind("error");
    try {
      const saved = await mutate(async revisionId => {
        const result = await saveItemImagesAction({
          itemId: item.id, expectedUpdatedAt: currentItem.current.updatedAt,
          images: submitted.map(entry => entry.image)
        });
        if (!result.ok) {
          if (result.code === "REVISION_CONFLICT") setConflict(true);
          throw new Error(result.error);
        }
        return { value: result.data, revisionId };
      });
      if (!active.current) return;
      onUpdated(saved); draft.acknowledge(submitted, imageDrafts(saved)); onClose();
    } catch (error) {
      if (active.current) setMessage(error instanceof Error ? error.message : "Images could not be saved. Your choices are retained.");
    }
  };
  const reviewLatest = async () => {
    if (locked) return;
    setReviewing(true); setMessageKind("error");
    try {
      const result = await loadItemWorkspaceOverviewAction(item.id);
      if (!active.current) return;
      if (result.ok) setReview(result.data); else setMessage(result.error);
    } catch {
      if (active.current) setMessage("Latest saved images could not be loaded. Your changes are retained; please retry.");
    } finally { if (active.current) setReviewing(false); }
  };

  return <EngineeringDialog title="Manage images" subtitle={item.displayName} dirty={draft.dirty} busy={locked} onClose={onClose}>
    <form className="space-y-5" onSubmit={event => { event.preventDefault(); void save(); }} onPaste={event => {
      const image = Array.from(event.clipboardData.files).find(file => file.type.startsWith("image/"));
      if (image) { event.preventDefault(); void addImage(image); }
    }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-slate-600">Add product photographs, choose the primary image and write useful captions.</p>
          <p className="mt-1 text-xs text-slate-500">PNG, JPEG or WebP · 10 MB per image · 20 MB total · up to {MAX_BOM_ITEM_IMAGES} images.</p></div>
        {!readOnly && <button type="button" className="icon-button icon-button-primary" disabled={locked || draft.draft.length >= MAX_BOM_ITEM_IMAGES} onClick={() => uploadInput.current?.click()}>
          <ImagePlus size={16} /> Add photograph
        </button>}
        <input ref={uploadInput} type="file" className="sr-only" tabIndex={-1} aria-label="Add photograph" accept="image/png,image/jpeg,image/webp" disabled={locked || readOnly}
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void addImage(file); }} />
      </div>
      {readOnly && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">This Item is archived. Its images are read-only.</p>}
      {readingImage && <p role="status" className="text-sm text-teal-700">Preparing image preview…</p>}
      <ItemWorkspaceMessage message={message} kind={messageKind} />
      {message && <button type="button" className="icon-button" disabled={locked} onClick={() => void reviewLatest()}>Review latest images</button>}
      {review && <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
        <h3 className="font-semibold">Latest saved images — your pending choices are retained</h3>
        {review.images.length ? <ul className="list-inside list-disc">{review.images.map(image => <li key={image.id}>{image.fileName}{image.isPrimary ? " · Primary" : ""}{image.caption ? ` — ${image.caption}` : ""}</li>)}</ul> : <p>No saved images.</p>}
        <p>Retrying replaces this saved collection with the image choices below. Remove references to images that are no longer available before retrying.</p>
        <button type="button" className="icon-button" disabled={locked} onClick={async () => {
          setReviewing(true);
          try {
            await reviewRevision(review.revisionId);
            if (!active.current) return;
            currentItem.current = review; onUpdated(review); draft.load(imageDrafts(review));
            setReview(null); setConflict(false); setMessageKind("info"); setMessage("Latest saved collection reviewed. Your changes are retained for an explicit save.");
          } catch { if (active.current) { setMessageKind("error"); setMessage("The saved version could not be adopted. Your changes are retained; please retry."); } }
          finally { if (active.current) setReviewing(false); }
        }}>Use reviewed image version</button>
      </section>}
      <fieldset disabled={locked || readOnly} className="space-y-4">
        <legend className="sr-only">Product image collection</legend>
        {draft.draft.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <ImagePlus size={28} className="mx-auto mb-3 text-slate-400" /><p className="text-sm font-medium">No product photographs</p>
          <p className="mt-1 text-sm text-slate-500">Add a photograph to show this Item in the catalogue.</p>
        </div>}
        {draft.draft.map(({ key, image }, index) => {
          const existing = image.kind === "existing" ? item.images.find(saved => saved.id === image.id) : undefined;
          const src = image.kind === "new" ? image.dataUrl : existing?.imageUrl;
          const fileName = image.kind === "new" ? image.fileName : existing?.fileName ?? "Image no longer available";
          const mimeType = image.kind === "new" ? image.mimeType : existing?.mimeType;
          return <article key={key} className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-[144px_minmax(0,1fr)]">
            <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              {src && mimeType ? <BomItemImageView src={src} mimeType={mimeType} alt={image.caption || fileName} sizes="144px" className="h-full w-full object-contain" /> : <p className="px-3 text-center text-xs text-slate-500">This saved image is no longer available. Remove it before saving.</p>}
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 break-all text-sm font-medium">{fileName}</h3>{image.kind === "new" && <span className="rounded bg-teal-50 px-2 py-0.5 text-xs text-teal-700">New</span>}</div>
              <label className="block text-sm">Caption<span className="ml-1 text-xs text-slate-400">Optional</span>
                <input className="field-input mt-1 w-full" aria-label={`Caption for image ${index + 1}`} maxLength={240} value={image.caption ?? ""} placeholder="Describe this product view" onChange={event => changeCaption(key, event.target.value)} />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name="item-primary-image" checked={image.isPrimary} onChange={() => draft.change(draft.snapshot().map(entry => ({ ...entry, image: { ...entry.image, isPrimary: entry.key === key } })))} />
                  <Star size={14} className={image.isPrimary ? "fill-teal-600 text-teal-600" : "text-slate-400"} /> Primary image
                </label>
                <button type="button" className="icon-button text-red-700" aria-label={`Remove image ${fileName}`} onClick={() => draft.change(draft.snapshot().filter(entry => entry.key !== key))}><Trash2 size={14} /> Remove image</button>
              </div>
            </div>
          </article>;
        })}
      </fieldset>
      <footer className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
        <p className="text-xs text-slate-500">{draft.draft.length} of {MAX_BOM_ITEM_IMAGES} images · Changes apply only when saved.</p>
        <div className="flex gap-2"><button type="button" className="icon-button" disabled={locked} onClick={close}>{readOnly ? "Close" : "Cancel"}</button>
          {!readOnly && <button className="icon-button icon-button-primary" disabled={locked || !draft.dirty || conflict}>{busy ? "Saving…" : "Save images"}</button>}</div>
      </footer>
    </form>
  </EngineeringDialog>;
}
