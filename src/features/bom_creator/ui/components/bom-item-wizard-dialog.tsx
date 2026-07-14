"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Plus,
  Star,
  Trash2,
  Upload,
  X
} from "lucide-react";
import {
  createBomItemCategoryAction,
  createBomItemManufacturerAction,
  createBomItemAction,
  updateBomItemAction
} from "../../api/actions";
import {
  type BomItemDetail,
  type BomItemFormOptions,
  type BomItemImageInput,
  type BomItemInput,
  type BomItemOption
} from "../../data/schema";
import {
  MAX_BOM_ITEM_IMAGE_BYTES,
  MAX_BOM_ITEM_IMAGES,
  MAX_BOM_ITEM_TOTAL_IMAGE_BYTES,
  validateBomItemImageBudget
} from "../../logic/services/bom-item-image-budget";
import {
  bomCurrencyOptions,
  bomUnitOptions,
  categoryLabel
} from "./bom-item-options";

type WizardStep = "general" | "images" | "supplier";
type OptionDialogKind = "category" | "manufacturer";

type WizardDraft = BomItemInput;

const steps: Array<{ key: WizardStep; label: string }> = [
  { key: "general", label: "General" },
  { key: "images", label: "Images" },
  { key: "supplier", label: "Cost & Supplier" }
];

const emptyDraft: WizardDraft = {
  displayName: "",
  category: "accessory",
  unit: "each",
  description: "",
  manufacturer: "",
  partNumber: "",
  model: "",
  notes: "",
  supplierName: "",
  supplierContactName: "",
  supplierEmail: "",
  supplierPhone: "",
  supplierWebsite: "",
  supplierSku: "",
  unitCost: undefined,
  currency: "",
  leadTimeDays: undefined,
  minimumOrderQuantity: undefined,
  costNotes: "",
  images: []
};

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) {
    const megabytes = value / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
  }

  if (value === 0) {
    return "0 KB";
  }

  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Image read failed."));
    reader.readAsDataURL(file);
  });
}

function normalizeImages(images: BomItemImageInput[]): BomItemImageInput[] {
  const hasPrimary = images.some((image) => image.isPrimary);

  return images.map((image, index) => ({
    ...image,
    isPrimary: hasPrimary ? image.isPrimary : index === 0,
    sortOrder: index
  }));
}

function detailToDraft(item: BomItemDetail): WizardDraft {
  return {
    displayName: item.displayName,
    category: item.category,
    unit: item.unit,
    description: item.description ?? "",
    manufacturer: item.manufacturer ?? "",
    partNumber: item.partNumber ?? "",
    model: item.model ?? "",
    notes: item.notes ?? "",
    supplierName: item.supplierName ?? "",
    supplierContactName: item.supplierContactName ?? "",
    supplierEmail: item.supplierEmail ?? "",
    supplierPhone: item.supplierPhone ?? "",
    supplierWebsite: item.supplierWebsite ?? "",
    supplierSku: item.supplierSku ?? "",
    unitCost: item.unitCost,
    currency: item.currency ?? "",
    leadTimeDays: item.leadTimeDays,
    minimumOrderQuantity: item.minimumOrderQuantity,
    costNotes: item.costNotes ?? "",
    images: normalizeImages(item.images)
  };
}

function imageKey(image: BomItemImageInput, index: number): string {
  return image.id ?? `${image.fileName}-${image.sizeBytes}-${index}`;
}

function toOptionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

function withCurrentOption(
  options: BomItemOption[],
  value: string | undefined,
  labelForValue: (value: string) => string = (optionValue) => optionValue
): BomItemOption[] {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return options;
  }

  if (
    options.some(
      (option) => option.value.toLowerCase() === trimmedValue.toLowerCase()
    )
  ) {
    return options;
  }

  return [
    ...options,
    {
      value: trimmedValue,
      label: labelForValue(trimmedValue)
    }
  ];
}

function mergeOption(
  options: BomItemOption[],
  nextOption: BomItemOption
): BomItemOption[] {
  const withoutDuplicate = options.filter(
    (option) => option.value.toLowerCase() !== nextOption.value.toLowerCase()
  );

  return [...withoutDuplicate, nextOption].sort((first, second) =>
    first.label.localeCompare(second.label, undefined, { numeric: true })
  );
}

function SmallOptionDialog({
  kind,
  onClose,
  onSaved
}: {
  kind: OptionDialogKind;
  onClose: () => void;
  onSaved: (option: BomItemOption) => void;
}) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const title = kind === "category" ? "Add category" : "Add manufacturer";
  const label = kind === "category" ? "Category name" : "Manufacturer name";

  const save = () => {
    startTransition(async () => {
      setMessage(null);
      const result =
        kind === "category"
          ? await createBomItemCategoryAction({ name: value })
          : await createBomItemManufacturerAction({ name: value });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      onSaved(result.data);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4"
      role="presentation"
    >
      <div
        aria-labelledby="bom-small-option-title"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3
            id="bom-small-option-title"
            className="text-base font-semibold text-slate-950"
          >
            {title}
          </h3>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label={`Close ${title.toLowerCase()} popup`}
            title="Close"
            onClick={onClose}
            disabled={isPending}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {message ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {message}
            </div>
          ) : null}
          <div>
            <label className="field-label" htmlFor="bom-small-option-name">
              {label}
            </label>
            <input
              id="bom-small-option-name"
              className="field-input"
              value={value}
              autoFocus
              onChange={(event) => setValue(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && value.trim().length > 0) {
                  event.preventDefault();
                  save();
                }
              }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={save}
            disabled={isPending || value.trim().length === 0}
          >
            <Plus aria-hidden="true" size={14} />
            {isPending ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BomItemWizardDialog({
  formOptions,
  mode,
  item,
  onClose,
  onSaved
}: {
  formOptions: BomItemFormOptions;
  mode: "create" | "edit";
  item?: BomItemDetail;
  onClose: () => void;
  onSaved?: (item: BomItemDetail) => void;
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<WizardStep>("general");
  const [draft, setDraft] = useState<WizardDraft>(() =>
    item ? detailToDraft(item) : emptyDraft
  );
  const [optionDialog, setOptionDialog] = useState<OptionDialogKind | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<BomItemOption[]>(() =>
    withCurrentOption(formOptions.categories, item?.category, categoryLabel)
  );
  const [manufacturerOptions, setManufacturerOptions] = useState<
    BomItemOption[]
  >(() => withCurrentOption(formOptions.manufacturers, item?.manufacturer));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeStepIndex = steps.findIndex((candidate) => candidate.key === step);
  const title = mode === "create" ? "New item" : `Edit ${item?.displayName ?? "item"}`;
  const canSave =
    draft.displayName.trim().length > 0 &&
    draft.category.trim().length > 0 &&
    draft.unit.trim().length > 0;

  const totalImageBytes = useMemo(
    () =>
      draft.images.reduce((total, image) => total + image.sizeBytes, 0),
    [draft.images]
  );
  const hasImageCapacity =
    draft.images.length < MAX_BOM_ITEM_IMAGES &&
    totalImageBytes < MAX_BOM_ITEM_TOTAL_IMAGE_BYTES;

  const updateDraft = (updates: Partial<WizardDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
  };

  const updateImage = (index: number, updates: Partial<BomItemImageInput>) => {
    setDraft((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, ...updates } : image
      )
    }));
  };

  const removeImage = (index: number) => {
    setDraft((current) => ({
      ...current,
      images: normalizeImages(
        current.images.filter((_, imageIndex) => imageIndex !== index)
      )
    }));
  };

  const setPrimaryImage = (index: number) => {
    setDraft((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) => ({
        ...image,
        isPrimary: imageIndex === index
      }))
    }));
  };

  const addFiles = async (files: File[]) => {
    setMessage(null);

    if (files.length === 0) {
      return;
    }

    if (files.some((file) => !file.type.startsWith("image/"))) {
      setMessage("Only image files can be added.");
      return;
    }

    const proposedBudget = validateBomItemImageBudget([
      ...draft.images.map((image) => ({ sizeBytes: image.sizeBytes })),
      ...files.map((file) => ({ sizeBytes: file.size }))
    ]);

    if (!proposedBudget.ok) {
      setMessage(proposedBudget.violations[0]?.message ?? "Images are invalid.");
      return;
    }

    const nextImages: BomItemImageInput[] = [];

    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);

      if (!dataUrl.startsWith("data:image/")) {
        setMessage("Only image data URLs can be stored.");
        return;
      }

      nextImages.push({
        id: crypto.randomUUID(),
        fileName: file.name || "pasted-image.png",
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl,
        caption: "",
        isPrimary: false,
        sortOrder: draft.images.length + nextImages.length
      });
    }

    const normalizedImages = normalizeImages([
      ...draft.images,
      ...nextImages
    ]);
    const finalBudget = validateBomItemImageBudget(normalizedImages);

    if (!finalBudget.ok) {
      setMessage(finalBudget.violations[0]?.message ?? "Images are invalid.");
      return;
    }

    setDraft((current) => ({
      ...current,
      images: normalizedImages
    }));
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void addFiles(files);
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    void addFiles(files);
  };

  const save = () => {
    if (!canSave) {
      setMessage("Display name, category, and unit are required.");
      setStep("general");
      return;
    }

    const normalizedImages = normalizeImages(draft.images);
    const imageBudget = validateBomItemImageBudget(normalizedImages);

    if (!imageBudget.ok) {
      setMessage(imageBudget.violations[0]?.message ?? "Images are invalid.");
      setStep("images");
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const normalizedDraft: BomItemInput = {
        ...draft,
        images: normalizedImages
      };
      const result =
        mode === "edit" && item
          ? await updateBomItemAction({
              ...normalizedDraft,
              id: item.id
            })
          : await createBomItemAction(normalizedDraft);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      onSaved?.(result.data);
      onClose();
    });
  };

  const nextStep = () => {
    if (step === "general" && !canSave) {
      setMessage("Complete the required general fields before continuing.");
      return;
    }

    setMessage(null);
    setStep(steps[Math.min(activeStepIndex + 1, steps.length - 1)].key);
  };

  const previousStep = () => {
    setMessage(null);
    setStep(steps[Math.max(activeStepIndex - 1, 0)].key);
  };

  const handleOptionSaved = (option: BomItemOption) => {
    if (optionDialog === "category") {
      setCategoryOptions((current) => mergeOption(current, option));
      updateDraft({ category: option.value });
    }

    if (optionDialog === "manufacturer") {
      setManufacturerOptions((current) => mergeOption(current, option));
      updateDraft({ manufacturer: option.value });
    }

    setOptionDialog(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"
      role="presentation"
    >
      <div
        aria-labelledby="bom-item-wizard-title"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="bom-item-wizard-title"
              className="truncate text-base font-semibold text-slate-950"
            >
              {title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Build the library item record, attach reference images, and capture purchasing data.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 shrink-0 p-0"
            aria-label="Close item wizard"
            title="Close"
            onClick={onClose}
            disabled={isPending}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {steps.map((candidate, index) => {
              const isActive = candidate.key === step;
              const isComplete = index < activeStepIndex;

              return (
                <button
                  key={candidate.key}
                  type="button"
                  className={[
                    "flex min-h-9 items-center gap-2 rounded-md border px-3 text-left text-xs font-semibold",
                    isActive
                      ? "border-teal-300 bg-teal-50 text-teal-800"
                      : "border-slate-200 bg-white text-slate-600"
                  ].join(" ")}
                  onClick={() => setStep(candidate.key)}
                >
                  <span
                    className={[
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px]",
                      isComplete
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-current"
                    ].join(" ")}
                  >
                    {isComplete ? <Check aria-hidden="true" size={12} /> : index + 1}
                  </span>
                  <span className="truncate">{candidate.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {message ? (
          <div
            aria-live="polite"
            className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs font-semibold text-amber-800"
            role="alert"
          >
            {message}
          </div>
        ) : null}

        <div
          className="max-h-[58vh] overflow-y-auto px-5 py-4"
          onPaste={handlePaste}
        >
          {step === "general" ? (
            <div className="grid gap-4 lg:grid-cols-4">
              <div>
                <span className="field-label">Item key</span>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  {mode === "edit" ? item?.itemKey : "Assigned on save"}
                </div>
              </div>
              <div className="lg:col-span-2">
                <label className="field-label" htmlFor="bom-display-name">
                  Display name
                </label>
                <input
                  id="bom-display-name"
                  className="field-input"
                  value={draft.displayName}
                  onChange={(event) =>
                    updateDraft({ displayName: event.currentTarget.value })
                  }
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="field-label mb-0" htmlFor="bom-category">
                    Category
                  </label>
                  <button
                    type="button"
                    className="icon-button h-7 w-7 p-0"
                    aria-label="Add category"
                    title="Add category"
                    onClick={() => setOptionDialog("category")}
                  >
                    <Plus aria-hidden="true" size={13} />
                  </button>
                </div>
                <select
                  id="bom-category"
                  className="field-input capitalize"
                  value={draft.category}
                  onChange={(event) =>
                    updateDraft({ category: event.currentTarget.value })
                  }
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="bom-unit">
                  Unit
                </label>
                <select
                  id="bom-unit"
                  className="field-input"
                  value={draft.unit}
                  onChange={(event) =>
                    updateDraft({ unit: event.currentTarget.value })
                  }
                >
                  {bomUnitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="field-label mb-0" htmlFor="bom-manufacturer">
                    Manufacturer
                  </label>
                  <button
                    type="button"
                    className="icon-button h-7 w-7 p-0"
                    aria-label="Add manufacturer"
                    title="Add manufacturer"
                    onClick={() => setOptionDialog("manufacturer")}
                  >
                    <Plus aria-hidden="true" size={13} />
                  </button>
                </div>
                <select
                  id="bom-manufacturer"
                  className="field-input"
                  value={draft.manufacturer ?? ""}
                  onChange={(event) =>
                    updateDraft({ manufacturer: event.currentTarget.value })
                  }
                >
                  <option value="">Select manufacturer</option>
                  {manufacturerOptions.map((manufacturer) => (
                    <option key={manufacturer.value} value={manufacturer.value}>
                      {manufacturer.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="bom-part-number">
                  Part number
                </label>
                <input
                  id="bom-part-number"
                  className="field-input"
                  value={draft.partNumber ?? ""}
                  onChange={(event) =>
                    updateDraft({ partNumber: event.currentTarget.value })
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="bom-model">
                  Model
                </label>
                <input
                  id="bom-model"
                  className="field-input"
                  value={draft.model ?? ""}
                  onChange={(event) =>
                    updateDraft({ model: event.currentTarget.value })
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <label className="field-label" htmlFor="bom-description">
                  Description
                </label>
                <textarea
                  id="bom-description"
                  className="field-input min-h-28"
                  value={draft.description ?? ""}
                  onChange={(event) =>
                    updateDraft({ description: event.currentTarget.value })
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <label className="field-label" htmlFor="bom-notes">
                  Notes
                </label>
                <textarea
                  id="bom-notes"
                  className="field-input min-h-28"
                  value={draft.notes ?? ""}
                  onChange={(event) =>
                    updateDraft({ notes: event.currentTarget.value })
                  }
                />
              </div>
            </div>
          ) : null}

          {step === "images" ? (
            <div className="grid gap-4">
              <div
                className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center"
                data-testid="bom-item-image-dropzone"
                tabIndex={0}
              >
                <ImagePlus
                  aria-hidden="true"
                  className="mx-auto text-slate-500"
                  size={26}
                />
                <div className="mt-3 text-sm font-semibold text-slate-950">
                  Paste images here or upload from disk
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {draft.images.length} / {MAX_BOM_ITEM_IMAGES} images. {formatBytes(totalImageBytes)} /{" "}
                  {formatBytes(MAX_BOM_ITEM_TOTAL_IMAGE_BYTES)} used. Each image
                  can be up to {formatBytes(MAX_BOM_ITEM_IMAGE_BYTES)}.
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
                <button
                  type="button"
                  className="icon-button mt-4"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={!hasImageCapacity}
                >
                  <Upload aria-hidden="true" size={14} />
                  Upload images
                </button>
              </div>

              {draft.images.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  No images added yet.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {draft.images.map((image, index) => (
                    <div
                      key={imageKey(image, index)}
                      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                    >
                      <div className="aspect-[4/3] bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.dataUrl}
                          alt={image.caption || image.fileName}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="grid gap-3 p-3">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-950">
                              {image.fileName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatBytes(image.sizeBytes)}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className={[
                                "icon-button h-8 w-8 p-0",
                                image.isPrimary ? "icon-button-primary" : ""
                              ].join(" ")}
                              aria-label={`Make ${image.fileName} primary`}
                              title="Primary image"
                              onClick={() => setPrimaryImage(index)}
                            >
                              <Star
                                aria-hidden="true"
                                size={14}
                                fill={image.isPrimary ? "currentColor" : "none"}
                              />
                            </button>
                            <button
                              type="button"
                              className="icon-button icon-button-danger h-8 w-8 p-0"
                              aria-label={`Remove ${image.fileName}`}
                              title="Remove image"
                              onClick={() => removeImage(index)}
                            >
                              <Trash2 aria-hidden="true" size={14} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label
                            className="field-label"
                            htmlFor={`bom-image-caption-${index}`}
                          >
                            Caption
                          </label>
                          <input
                            id={`bom-image-caption-${index}`}
                            className="field-input"
                            value={image.caption ?? ""}
                            onChange={(event) =>
                              updateImage(index, {
                                caption: event.currentTarget.value
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {step === "supplier" ? (
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className="field-label" htmlFor="bom-supplier-name">
                  Supplier
                </label>
                <input
                  id="bom-supplier-name"
                  className="field-input"
                  value={draft.supplierName ?? ""}
                  onChange={(event) =>
                    updateDraft({ supplierName: event.currentTarget.value })
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="bom-supplier-sku">
                  Supplier SKU
                </label>
                <input
                  id="bom-supplier-sku"
                  className="field-input"
                  value={draft.supplierSku ?? ""}
                  onChange={(event) =>
                    updateDraft({ supplierSku: event.currentTarget.value })
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="bom-unit-cost">
                  Unit cost
                </label>
                <input
                  id="bom-unit-cost"
                  className="field-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.unitCost ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      unitCost: toOptionalNumber(event.currentTarget.value)
                    })
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="bom-currency">
                  Currency
                </label>
                <input
                  id="bom-currency"
                  className="field-input"
                  list="bom-currency-options"
                  value={draft.currency ?? ""}
                  onChange={(event) =>
                    updateDraft({ currency: event.currentTarget.value })
                  }
                />
                <datalist id="bom-currency-options">
                  {bomCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="field-label" htmlFor="bom-lead-time">
                  Lead time days
                </label>
                <input
                  id="bom-lead-time"
                  className="field-input"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.leadTimeDays ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      leadTimeDays: toOptionalNumber(event.currentTarget.value)
                    })
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="bom-moq">
                  MOQ
                </label>
                <input
                  id="bom-moq"
                  className="field-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.minimumOrderQuantity ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      minimumOrderQuantity: toOptionalNumber(
                        event.currentTarget.value
                      )
                    })
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <label className="field-label" htmlFor="bom-supplier-website">
                  Website
                </label>
                <input
                  id="bom-supplier-website"
                  className="field-input"
                  value={draft.supplierWebsite ?? ""}
                  onChange={(event) =>
                    updateDraft({ supplierWebsite: event.currentTarget.value })
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="bom-supplier-contact">
                  Contact
                </label>
                <input
                  id="bom-supplier-contact"
                  className="field-input"
                  value={draft.supplierContactName ?? ""}
                  onChange={(event) =>
                    updateDraft({ supplierContactName: event.currentTarget.value })
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="bom-supplier-email">
                  Email
                </label>
                <input
                  id="bom-supplier-email"
                  className="field-input"
                  value={draft.supplierEmail ?? ""}
                  onChange={(event) =>
                    updateDraft({ supplierEmail: event.currentTarget.value })
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="bom-supplier-phone">
                  Phone
                </label>
                <input
                  id="bom-supplier-phone"
                  className="field-input"
                  value={draft.supplierPhone ?? ""}
                  onChange={(event) =>
                    updateDraft({ supplierPhone: event.currentTarget.value })
                  }
                />
              </div>
              <div className="lg:col-span-4">
                <label className="field-label" htmlFor="bom-cost-notes">
                  Cost notes
                </label>
                <textarea
                  id="bom-cost-notes"
                  className="field-input min-h-24"
                  value={draft.costNotes ?? ""}
                  onChange={(event) =>
                    updateDraft({ costNotes: event.currentTarget.value })
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            className="icon-button"
            onClick={previousStep}
            disabled={activeStepIndex === 0 || isPending}
          >
            <ChevronLeft aria-hidden="true" size={14} />
            Back
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            {activeStepIndex < steps.length - 1 ? (
              <button
                type="button"
                className="icon-button icon-button-primary"
                onClick={nextStep}
                disabled={isPending}
              >
                Next
                <ChevronRight aria-hidden="true" size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="icon-button icon-button-primary"
                onClick={save}
                disabled={isPending}
              >
                <Check aria-hidden="true" size={14} />
                {isPending ? "Saving..." : "Save item"}
              </button>
            )}
          </div>
        </div>

        {optionDialog ? (
          <SmallOptionDialog
            kind={optionDialog}
            onClose={() => setOptionDialog(null)}
            onSaved={handleOptionSaved}
          />
        ) : null}
      </div>
    </div>
  );
}
