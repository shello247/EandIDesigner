"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Plus } from "lucide-react";
import {
  getBomItemDetailAction,
  getBomItemFormOptionsAction
} from "../../api/actions";
import type {
  BomItemDetail,
  BomItemAppliedFilters,
  BomItemFilterOptions,
  BomItemFormOptions,
  BomItemListResult,
  BomItemListRow
} from "../../data/schema";
import {
  buildBomItemListUrl,
  hasBomItemFilters
} from "../../logic/services/bom-item-list-url";
import { BomItemsFilters } from "./bom-items-filters";
import { BomItemsPagination } from "./bom-items-pagination";
import { BomItemsTable } from "./bom-items-table";

const loadWizardModule = () => import("./bom-item-wizard-dialog");
const loadDeleteDialogModule = () => import("./bom-item-delete-dialog");

function DialogLoading({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4">
      <div
        className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-xl"
        role="status"
      >
        {label}
      </div>
    </div>
  );
}

const BomItemWizardDialog = dynamic(
  () => loadWizardModule().then((module) => module.BomItemWizardDialog),
  {
    ssr: false,
    loading: () => <DialogLoading label="Loading item editor..." />
  }
);

const BomItemDeleteDialog = dynamic(
  () =>
    loadDeleteDialogModule().then((module) => module.BomItemDeleteDialog),
  {
    ssr: false,
    loading: () => <DialogLoading label="Loading confirmation..." />
  }
);

type WizardState =
  | {
      mode: "create";
      item?: undefined;
      formOptions: BomItemFormOptions;
    }
  | { mode: "edit"; item: BomItemDetail; formOptions: BomItemFormOptions };

function toListRow(item: BomItemDetail): BomItemListRow {
  return {
    id: item.id,
    itemKey: item.itemKey,
    displayName: item.displayName,
    category: item.category,
    unit: item.unit,
    manufacturer: item.manufacturer,
    partNumber: item.partNumber,
    supplierName: item.supplierName,
    supplierSku: item.supplierSku,
    unitCost: item.unitCost,
    currency: item.currency,
    primaryImage: item.primaryImage,
    templateLineCount: item.templateLineCount
  };
}

function matchesAppliedFilters(
  item: BomItemListRow,
  filters: BomItemAppliedFilters
): boolean {
  if (filters.category && item.category !== filters.category) {
    return false;
  }

  if (filters.manufacturer && item.manufacturer !== filters.manufacturer) {
    return false;
  }

  const query = filters.query?.toLocaleLowerCase();
  if (!query) {
    return true;
  }

  return [
    item.itemKey,
    item.displayName,
    item.partNumber,
    item.manufacturer,
    item.supplierName
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}

export function BomItemsLibraryShell({
  filterOptions,
  result
}: {
  filterOptions: BomItemFilterOptions;
  result: BomItemListResult;
}) {
  const router = useRouter();
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [deleteItem, setDeleteItem] = useState<BomItemListRow | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [removedItemIds, setRemovedItemIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [itemOverrides, setItemOverrides] = useState<
    ReadonlyMap<string, BomItemListRow>
  >(() => new Map());
  const [isLoadingModal, startModalTransition] = useTransition();
  const clearFiltersUrl = buildBomItemListUrl({
    filters: {},
    page: 1,
    pageSize: result.pageSize
  });
  const hasFilters = hasBomItemFilters(result.appliedFilters);
  const visibleItems = result.items
    .filter((item) => !removedItemIds.has(item.id))
    .map((item) => itemOverrides.get(item.id) ?? item);

  const openCreate = () => {
    setMessage(null);
    setBusyItemId("create");
    startModalTransition(async () => {
      const [optionsResult] = await Promise.all([
        getBomItemFormOptionsAction(),
        loadWizardModule()
      ]);

      if (!optionsResult.ok) {
        setMessage(optionsResult.error);
        setBusyItemId(null);
        return;
      }

      setWizard({ mode: "create", formOptions: optionsResult.data });
      setBusyItemId(null);
    });
  };

  const openEdit = (item: BomItemListRow) => {
    setMessage(null);
    setBusyItemId(item.id);
    startModalTransition(async () => {
      const [detailResult, optionsResult] = await Promise.all([
        getBomItemDetailAction(item.id),
        getBomItemFormOptionsAction(),
        loadWizardModule()
      ]);

      if (!detailResult.ok || !detailResult.data || !optionsResult.ok) {
        setMessage(
          !detailResult.ok
            ? detailResult.error
            : !detailResult.data
              ? "BOM item could not be loaded."
              : optionsResult.ok
                ? "BOM item options could not be loaded."
                : optionsResult.error
        );
        setBusyItemId(null);
        return;
      }

      setWizard({
        mode: "edit",
        item: detailResult.data,
        formOptions: optionsResult.data
      });
      setBusyItemId(null);
    });
  };

  const handleSaved = (item: BomItemDetail) => {
    const row = toListRow(item);

    if (matchesAppliedFilters(row, result.appliedFilters)) {
      setItemOverrides((current) => {
        const next = new Map(current);
        next.set(row.id, row);
        return next;
      });
    } else {
      setRemovedItemIds((current) => new Set(current).add(row.id));
    }

    setWizard(null);
    setMessage("BOM item saved.");
    router.refresh();
  };

  const handleDeleted = (result: { id: string; mode: "deleted" | "archived" }) => {
    setRemovedItemIds((current) => new Set(current).add(result.id));
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
          onClick={openCreate}
          disabled={isLoadingModal && busyItemId === "create"}
        >
          <Plus aria-hidden="true" size={14} />
          {isLoadingModal && busyItemId === "create" ? "Loading..." : "New item"}
        </button>
      </div>

      <BomItemsFilters
        filters={result.appliedFilters}
        options={filterOptions}
        pageSize={result.pageSize}
      />

      {message ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">
          <AlertCircle aria-hidden="true" size={14} className="text-teal-700" />
          <span>{message}</span>
        </div>
      ) : null}

      <div className="tool-panel overflow-hidden">
        <BomItemsTable
          items={visibleItems}
          onEdit={openEdit}
          onDelete={(item) => {
            setMessage(null);
            void loadDeleteDialogModule();
            setDeleteItem(item);
          }}
          busyItemId={isLoadingModal ? busyItemId : null}
          clearFiltersUrl={clearFiltersUrl}
          hasFilters={hasFilters}
        />
        <BomItemsPagination result={result} />
      </div>

      {wizard ? (
        <BomItemWizardDialog
          key={wizard.mode === "edit" ? wizard.item.id : "create"}
          formOptions={wizard.formOptions}
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
