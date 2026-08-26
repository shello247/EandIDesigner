"use client";

import { Pencil, Star, Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  createWireCatalogEntryAction,
  deleteWireCatalogEntryAction,
  setDefaultWireCatalogEntryAction,
  updateWireCatalogEntryAction
} from "../../api/actions";
import type { WireCatalogEntry } from "../../data/schema";
import {
  draftFromWireCatalogEntry,
  emptyWireCatalogEntryDraft,
  WireCatalogEntryForm,
  type WireCatalogEntryDraft
} from "./wire-catalog-entry-form";

export function WireCatalogManager({
  open,
  initialEntries,
  onClose,
  onEntriesUpdated
}: {
  open: boolean;
  initialEntries: WireCatalogEntry[];
  onClose: () => void;
  onEntriesUpdated: (entries: WireCatalogEntry[]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState(initialEntries);
  const [draft, setDraft] = useState<WireCatalogEntryDraft>(
    emptyWireCatalogEntryDraft
  );
  const [deleting, setDeleting] = useState<WireCatalogEntry | null>(null);
  const [replacementDefaultId, setReplacementDefaultId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        if (deleting) setDeleting(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleting, isPending, onClose, open]);

  if (!open) return null;

  const updateEntries = (next: WireCatalogEntry[]) => {
    setEntries(next);
    onEntriesUpdated(next);
    setDraft(emptyWireCatalogEntryDraft);
    setDeleting(null);
    setReplacementDefaultId("");
    setMessage("Wire Catalog updated.");
  };

  const saveDraft = () => {
    setMessage(null);
    startTransition(async () => {
      const payload = {
        name: draft.name,
        wireType: draft.wireType,
        size: draft.size,
        color: draft.color,
        notes: draft.notes || undefined,
        makeDefault: draft.makeDefault
      };
      const result = draft.entryId
        ? await updateWireCatalogEntryAction({
            entryId: draft.entryId,
            ...payload
          })
        : await createWireCatalogEntryAction(payload);
      if (!result.ok) return setMessage(result.error);
      updateEntries(result.data);
    });
  };

  const setDefault = (entryId: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await setDefaultWireCatalogEntryAction({ entryId });
      if (!result.ok) return setMessage(result.error);
      updateEntries(result.data);
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteWireCatalogEntryAction({
        entryId: deleting.id,
        replacementDefaultId:
          deleting.isDefault && entries.length > 1
            ? replacementDefaultId || undefined
            : undefined
      });
      if (!result.ok) return setMessage(result.error);
      updateEntries(result.data);
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[1px]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isPending) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wire-catalog-title"
          className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="wire-catalog-title" className="text-base font-semibold">
                Wire Catalog
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Approved wire type, size, and color combinations for internal panel wiring.
              </p>
            </div>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Close Wire Catalog"
              disabled={isPending}
              onClick={onClose}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 gap-5 overflow-auto p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 overflow-auto rounded-md border border-slate-200">
              {entries.length ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Specification</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2">Color</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-200">
                        <td className="px-3 py-2.5">
                          <span className="font-semibold">{entry.name}</span>
                          {entry.isDefault ? (
                            <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700">
                              Default
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">{entry.wireType}</td>
                        <td className="px-3 py-2.5">{entry.size}</td>
                        <td className="px-3 py-2.5">{entry.color}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="icon-button h-8 w-8 p-0"
                              aria-label={`Make ${entry.name} default`}
                              title="Make default"
                              disabled={isPending || entry.isDefault}
                              onClick={() => setDefault(entry.id)}
                            >
                              <Star aria-hidden="true" size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-button h-8 w-8 p-0"
                              aria-label={`Edit ${entry.name}`}
                              disabled={isPending}
                              onClick={() => setDraft(draftFromWireCatalogEntry(entry))}
                            >
                              <Pencil aria-hidden="true" size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-button h-8 w-8 p-0 text-red-600"
                              aria-label={`Delete ${entry.name}`}
                              disabled={isPending}
                              onClick={() => {
                                setDeleting(entry);
                                setReplacementDefaultId(
                                  entries.find((candidate) => candidate.id !== entry.id)?.id ?? ""
                                );
                              }}
                            >
                              <Trash2 aria-hidden="true" size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  No wire specifications are defined. Create the first entry to make it the default.
                </div>
              )}
            </div>
            <div className="space-y-3">
              <WireCatalogEntryForm
                draft={draft}
                pending={isPending}
                onChange={setDraft}
                onSave={saveDraft}
                onReset={() => setDraft(emptyWireCatalogEntryDraft)}
              />
              {message ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {deleting ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-wire-catalog-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-200 p-5">
              <h2 id="delete-wire-catalog-title" className="text-sm font-semibold">
                Delete {deleting.name}?
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Existing wires keep their stored specification snapshot.
              </p>
            </div>
            <div className="space-y-3 p-5">
              {deleting.isDefault && entries.length > 1 ? (
                <label className="grid gap-1">
                  <span className="field-label">Replacement default</span>
                  <select
                    className="field-input"
                    value={replacementDefaultId}
                    disabled={isPending}
                    onChange={(event) =>
                      setReplacementDefaultId(event.currentTarget.value)
                    }
                  >
                    <option value="">Choose replacement</option>
                    {entries
                      .filter((entry) => entry.id !== deleting.id)
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.name}</option>
                      ))}
                  </select>
                </label>
              ) : null}
              {message ? <p className="text-xs text-red-700">{message}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="icon-button border-red-200 text-red-700"
                disabled={
                  isPending ||
                  (deleting.isDefault && entries.length > 1 && !replacementDefaultId)
                }
                onClick={confirmDelete}
              >
                <Trash2 aria-hidden="true" size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
