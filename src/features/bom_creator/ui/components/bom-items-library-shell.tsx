"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { getBomItemDetailAction } from "../../api/actions";
import type {
  BomItemDetail,
  BomItemFormOptions,
  BomItemSummary
} from "../../data/schema";
import { BomItemDeleteDialog } from "./bom-item-delete-dialog";
import { BomItemWizardDialog } from "./bom-item-wizard-dialog";
import { BomItemsTable } from "./bom-items-table";

type WizardState =
  | { mode: "create"; item?: undefined }
  | { mode: "edit"; item: BomItemDetail };

export function BomItemsLibraryShell({
  formOptions,
  items
}: {
  formOptions: BomItemFormOptions;
  items: BomItemSummary[];
}) {
  const router = useRouter();
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [deleteItem, setDeleteItem] = useState<BomItemSummary | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingDetail, startDetailTransition] = useTransition();

  const openEdit = (item: BomItemSummary) => {
    setMessage(null);
    setBusyItemId(item.id);
    startDetailTransition(async () => {
      const result = await getBomItemDetailAction(item.id);

      if (!result.ok || !result.data) {
        setMessage(result.ok ? "BOM item could not be loaded." : result.error);
        setBusyItemId(null);
        return;
      }

      setWizard({ mode: "edit", item: result.data });
      setBusyItemId(null);
    });
  };

  const handleSaved = () => {
    setMessage("BOM item saved.");
    router.refresh();
  };

  const handleDeleted = (result: { id: string; mode: "deleted" | "archived" }) => {
    setDeleteItem(null);
    setMessage(result.mode === "archived" ? "BOM item archived." : "BOM item deleted.");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Items Library</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Controlled purchasable and consumable materials used by symbol mini BOMs.
          </p>
        </div>
        <button
          type="button"
          className="icon-button icon-button-primary"
          onClick={() => {
            setMessage(null);
            setWizard({ mode: "create" });
          }}
        >
          <Plus aria-hidden="true" size={14} />
          New item
        </button>
      </div>

      {message ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">
          <AlertCircle aria-hidden="true" size={14} className="text-teal-700" />
          <span>{message}</span>
        </div>
      ) : null}

      <BomItemsTable
        items={items}
        onEdit={openEdit}
        onDelete={(item) => {
          setMessage(null);
          setDeleteItem(item);
        }}
        busyItemId={isLoadingDetail ? busyItemId : null}
      />

      {wizard ? (
        <BomItemWizardDialog
          key={wizard.mode === "edit" ? wizard.item.id : "create"}
          formOptions={formOptions}
          mode={wizard.mode}
          item={wizard.item}
          onClose={() => setWizard(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deleteItem ? (
        <BomItemDeleteDialog
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}
