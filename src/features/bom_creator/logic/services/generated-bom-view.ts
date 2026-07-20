import type {
  ConsolidatedBomLine,
  GeneratedBomAssembly,
  GeneratedBomWarning,
  GeneratedBomWarningCode,
  GeneratedDrawingBom
} from "../../data/schema";

export type GeneratedBomViewKind = "consolidated" | "assembly" | "review";

export type GeneratedBomViewInput = {
  view: GeneratedBomViewKind;
  page: number;
  pageSize: number;
};

export type GeneratedBomWarningSummary = {
  code: GeneratedBomWarningCode;
  count: number;
};

export type GeneratedBomConsolidatedViewLine = Omit<
  ConsolidatedBomLine,
  "sourceAssetTags"
> & {
  sourceAssetCount: number;
  sourceAssetPreview: string[];
};

type GeneratedBomViewBase = {
  drawingId: string;
  drawingTitle: string;
  assemblyCount: number;
  consolidatedLineCount: number;
  warningCount: number;
  warningSummary: GeneratedBomWarningSummary[];
  page: number;
  pageSize: number;
  totalPages: number;
};

export type GeneratedBomViewModel =
  | (GeneratedBomViewBase & {
      view: "consolidated";
      consolidatedLines: GeneratedBomConsolidatedViewLine[];
    })
  | (GeneratedBomViewBase & {
      view: "assembly";
      assemblies: GeneratedBomAssembly[];
    })
  | (GeneratedBomViewBase & {
      view: "review";
      warnings: GeneratedBomWarning[];
    });

const warningCodeOrder: GeneratedBomWarningCode[] = [
  "missing_template",
  "missing_item",
  "archived_item",
  "manual_quantity_required",
  "generated_symbol",
  "missing_symbol"
];

const viewLimits: Record<
  GeneratedBomViewKind,
  { defaultPageSize: number; maxPageSize: number }
> = {
  consolidated: { defaultPageSize: 50, maxPageSize: 100 },
  assembly: { defaultPageSize: 25, maxPageSize: 50 },
  review: { defaultPageSize: 50, maxPageSize: 100 }
};

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const candidate = Number(firstValue(value));

  return Number.isInteger(candidate) && candidate >= 1 && candidate <= maximum
    ? candidate
    : fallback;
}

export function parseGeneratedBomViewSearchParams(
  searchParams: Record<string, unknown>
): GeneratedBomViewInput {
  const rawView = firstValue(searchParams.view);
  const view: GeneratedBomViewKind =
    rawView === "assembly" || rawView === "review"
      ? rawView
      : "consolidated";
  const limits = viewLimits[view];

  return {
    view,
    page: positiveInteger(searchParams.page, 1, 1_000_000),
    pageSize: positiveInteger(
      searchParams.pageSize,
      limits.defaultPageSize,
      limits.maxPageSize
    )
  };
}

export function buildGeneratedBomViewUrl(input: {
  drawingId: string;
  view: GeneratedBomViewKind;
  page?: number;
  pageSize?: number;
}): string {
  const params = new URLSearchParams({ drawingId: input.drawingId });
  const limits = viewLimits[input.view];

  if (input.view !== "consolidated") {
    params.set("view", input.view);
  }

  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }

  if (input.pageSize && input.pageSize !== limits.defaultPageSize) {
    params.set("pageSize", String(input.pageSize));
  }

  return `/bom?${params.toString()}`;
}

function warningSummary(
  warnings: readonly GeneratedBomWarning[]
): GeneratedBomWarningSummary[] {
  const counts = new Map<GeneratedBomWarningCode, number>();

  for (const warning of warnings) {
    counts.set(warning.code, (counts.get(warning.code) ?? 0) + 1);
  }

  return warningCodeOrder.flatMap((code) => {
    const count = counts.get(code) ?? 0;
    return count > 0 ? [{ code, count }] : [];
  });
}

function pageBounds(totalItems: number, input: GeneratedBomViewInput) {
  const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
  const page = Math.min(input.page, totalPages);
  const start = (page - 1) * input.pageSize;

  return { page, totalPages, start, end: start + input.pageSize };
}

export function selectGeneratedBomView(
  bom: GeneratedDrawingBom,
  input: GeneratedBomViewInput
): GeneratedBomViewModel {
  const common = {
    drawingId: bom.drawingId,
    drawingTitle: bom.drawingTitle,
    assemblyCount: bom.assemblies.length,
    consolidatedLineCount: bom.consolidatedLines.length,
    warningCount: bom.warnings.length,
    warningSummary: warningSummary(bom.warnings),
    pageSize: input.pageSize
  };

  if (input.view === "assembly") {
    const bounds = pageBounds(bom.assemblies.length, input);
    return {
      ...common,
      view: "assembly",
      page: bounds.page,
      totalPages: bounds.totalPages,
      assemblies: bom.assemblies.slice(bounds.start, bounds.end)
    };
  }

  if (input.view === "review") {
    const bounds = pageBounds(bom.warnings.length, input);
    return {
      ...common,
      view: "review",
      page: bounds.page,
      totalPages: bounds.totalPages,
      warnings: bom.warnings.slice(bounds.start, bounds.end)
    };
  }

  const bounds = pageBounds(bom.consolidatedLines.length, input);
  return {
    ...common,
    view: "consolidated",
    page: bounds.page,
    totalPages: bounds.totalPages,
    consolidatedLines: bom.consolidatedLines
      .slice(bounds.start, bounds.end)
      .map(({ sourceAssetTags, ...line }) => ({
        ...line,
        sourceAssetCount: sourceAssetTags.length,
        sourceAssetPreview: sourceAssetTags.slice(0, 8)
      }))
  };
}
