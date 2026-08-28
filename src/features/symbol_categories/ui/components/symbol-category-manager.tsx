"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createSymbolCategoryAction,
  deleteSymbolCategoryAction,
  updateSymbolCategoryAction
} from "../../api/actions";
import {
  PROTECTED_SYMBOL_CATEGORY_NAME,
  type SymbolCategoryRecord
} from "../../api/public";

type CategoryDraft = {
  categoryId?: string;
  name: string;
  description: string;
};

const emptyDraft: CategoryDraft = {
  name: "",
  description: ""
};

export type SymbolCategoryManagerUpdate = {
  categories: SymbolCategoryRecord[];
  deletedCategoryId?: string;
  replacementCategoryId?: string;
};

export function SymbolCategoryManager({
  initialCategories,
  trigger = "button",
  onCategoriesUpdated
}: {
  initialCategories: SymbolCategoryRecord[];
  trigger?: "button" | "icon";
  onCategoriesUpdated?: (update: SymbolCategoryManagerUpdate) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [deleting, setDeleting] = useState<SymbolCategoryRecord | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        if (deleting) {
          setDeleting(null);
          return;
        }
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleting, isPending, open]);

  const updateCategories = (
    next: SymbolCategoryRecord[],
    change?: Omit<SymbolCategoryManagerUpdate, "categories">
  ) => {
    setCategories(next);
    setDraft(emptyDraft);
    setDeleting(null);
    setReplacementCategoryId("");
    setMessage("Categories updated.");
    onCategoriesUpdated?.({ categories: next, ...change });
    router.refresh();
  };

  const saveDraft = () => {
    setMessage(null);
    startTransition(async () => {
      const result = draft.categoryId
        ? await updateSymbolCategoryAction({
            categoryId: draft.categoryId,
            name: draft.name,
            description: draft.description || undefined
          })
        : await createSymbolCategoryAction({
            name: draft.name,
            description: draft.description || undefined
          });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      updateCategories(result.data);
    });
  };

  const confirmDelete = () => {
    if (!deleting) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteSymbolCategoryAction({
        categoryId: deleting.id,
        replacementCategoryId:
          deleting.symbolCount > 0 ? replacementCategoryId || undefined : undefined
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      updateCategories(result.data, {
        deletedCategoryId: deleting.id,
        replacementCategoryId:
          deleting.symbolCount > 0
            ? replacementCategoryId || undefined
            : undefined
      });
    });
  };

  const otherCategory = categories.find(
    (category) => category.name === PROTECTED_SYMBOL_CATEGORY_NAME
  );

  return (
    <>
      <button
        type="button"
        className={
          trigger === "icon"
            ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
            : "icon-button"
        }
        aria-label={trigger === "icon" ? "Manage categories" : undefined}
        title={trigger === "icon" ? "Manage categories" : undefined}
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
      >
        <Tags aria-hidden="true" size={trigger === "icon" ? 19 : 17} />
        {trigger === "button" ? "Manage categories" : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[1px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setOpen(false);
            }
          }}
        >
          <div
            className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="symbol-category-manager-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2
                  id="symbol-category-manager-title"
                  className="text-base font-semibold"
                >
                  Symbol Categories
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Categories organize the registry and drawing library. They do
                  not change technical behavior.
                </p>
              </div>
              <button
                type="button"
                className="icon-button h-8 w-8 p-0"
                aria-label="Close category manager"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" size={15} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-5 overflow-auto p-5 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Category</th>
                      <th className="w-20 px-3 py-2 text-right font-semibold">
                        Symbols
                      </th>
                      <th className="w-24 px-3 py-2 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr
                        key={category.id}
                        className="border-t border-slate-200 align-top"
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-slate-900">
                            {category.name}
                          </span>
                          {category.description ? (
                            <span className="mt-0.5 block leading-4 text-slate-500">
                              {category.description}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">
                          {category.symbolCount}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="icon-button h-8 w-8 p-0"
                              aria-label={`Edit ${category.name}`}
                              title={`Edit ${category.name}`}
                              disabled={isPending}
                              onClick={() => {
                                setMessage(null);
                                setDraft({
                                  categoryId: category.id,
                                  name: category.name,
                                  description: category.description ?? ""
                                });
                              }}
                            >
                              <Pencil aria-hidden="true" size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-button h-8 w-8 p-0 text-red-600"
                              aria-label={`Delete ${category.name}`}
                              title={`Delete ${category.name}`}
                              disabled={isPending || category.isProtected}
                              onClick={() => {
                                setMessage(null);
                                setDeleting(category);
                                setReplacementCategoryId(
                                  otherCategory?.id === category.id
                                    ? ""
                                    : otherCategory?.id ?? ""
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
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {draft.categoryId ? "Edit category" : "New category"}
                    </h3>
                    {draft.categoryId ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                        disabled={isPending}
                        onClick={() => setDraft(emptyDraft)}
                      >
                        <Plus className="mr-1 inline" aria-hidden="true" size={12} />
                        Add new
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <label className="grid gap-1">
                      <span className="field-label">Name</span>
                      <input
                        className="field-input"
                        value={draft.name}
                        maxLength={80}
                        autoFocus
                        disabled={
                          isPending ||
                          categories.some(
                            (category) =>
                              category.id === draft.categoryId &&
                              category.isProtected
                          )
                        }
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({
                            ...current,
                            name: value
                          }));
                        }}
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="field-label">Description</span>
                      <textarea
                        className="field-input min-h-24 resize-y"
                        value={draft.description}
                        maxLength={240}
                        disabled={isPending}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({
                            ...current,
                            description: value
                          }));
                        }}
                      />
                      <span className="text-right text-[11px] text-slate-400">
                        {draft.description.length}/240
                      </span>
                    </label>
                    <button
                      type="button"
                      className="icon-button icon-button-primary w-full justify-center"
                      disabled={isPending || !draft.name.trim()}
                      onClick={saveDraft}
                    >
                      {isPending
                        ? "Saving…"
                        : draft.categoryId
                          ? "Save category"
                          : "Create category"}
                    </button>
                  </div>
                </div>

                {message ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {message}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-symbol-category-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2
                id="delete-symbol-category-title"
                className="text-sm font-semibold"
              >
                Delete {deleting.name}?
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {deleting.symbolCount > 0
                  ? `${deleting.symbolCount} symbol${deleting.symbolCount === 1 ? "" : "s"} must be reassigned first.`
                  : "This category is not assigned to any symbols."}
              </p>
            </div>
            <div className="space-y-3 p-5">
              {deleting.symbolCount > 0 ? (
                <label className="grid gap-1">
                  <span className="field-label">Replacement category</span>
                  <select
                    className="field-input"
                    value={replacementCategoryId}
                    disabled={isPending}
                    onChange={(event) =>
                      setReplacementCategoryId(event.currentTarget.value)
                    }
                  >
                    <option value="">Choose replacement</option>
                    {categories
                      .filter((category) => category.id !== deleting.id)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              {message ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {message}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
                onClick={() => {
                  setDeleting(null);
                  setMessage(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="icon-button border-red-200 text-red-700 hover:bg-red-50"
                disabled={
                  isPending ||
                  (deleting.symbolCount > 0 && !replacementCategoryId)
                }
                onClick={confirmDelete}
              >
                <Trash2 aria-hidden="true" size={14} />
                {isPending ? "Deleting…" : "Reassign and delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
