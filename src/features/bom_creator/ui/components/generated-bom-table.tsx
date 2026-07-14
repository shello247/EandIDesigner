import type { GeneratedDrawingBom, GeneratedBomLine } from "../../data/schema";

function formatQuantity(line: GeneratedBomLine): string {
  if (line.quantityStatus === "manual_required") {
    return "Manual";
  }

  if (line.quantityStatus === "unavailable" || line.quantity === undefined) {
    return "-";
  }

  return Number.isInteger(line.quantity)
    ? String(line.quantity)
    : line.quantity.toFixed(3).replace(/0+$/g, "").replace(/\.$/, "");
}

function ruleLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function GeneratedBomTable({ bom }: { bom: GeneratedDrawingBom }) {
  return (
    <div className="space-y-5">
      {bom.warnings.length > 0 ? (
        <div className="tool-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-bold">BOM Review</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {bom.warnings.map((warning, index) => (
              <div key={`${warning.code}-${index}`} className="px-4 py-3 text-sm">
                <div className="font-semibold capitalize text-amber-700">
                  {warning.code.replace(/_/g, " ")}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {warning.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Consolidated BOM</h2>
        </div>
        {bom.consolidatedLines.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            No linked BOM items were generated.
          </div>
        ) : (
          <table className="data-table" data-testid="consolidated-bom-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Manufacturer</th>
                <th>Part</th>
                <th>Source Assets</th>
              </tr>
            </thead>
            <tbody>
              {bom.consolidatedLines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <div className="font-bold text-slate-950">
                      {line.displayName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {line.itemKey}
                    </div>
                  </td>
                  <td className="capitalize">{line.category.replace(/_/g, " ")}</td>
                  <td className="font-semibold">{formatQuantity(line)}</td>
                  <td>{line.unit}</td>
                  <td>{line.manufacturer ?? "-"}</td>
                  <td>{line.partNumber ?? "-"}</td>
                  <td>{line.sourceAssetTags.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Assembly View</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {bom.assemblies.map((assembly) => (
            <section key={assembly.assetId} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    {assembly.assetTag}
                  </h3>
                  <div className="mt-1 text-xs text-slate-500">
                    {assembly.title} / {assembly.assetType.replace(/_/g, " ")}
                    {assembly.symbolName ? ` / ${assembly.symbolName}` : ""}
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {assembly.sheetRefs.length > 0
                    ? assembly.sheetRefs
                        .map((ref) => `S${ref.sheetNumber} ${ref.sheetName}`)
                        .join(", ")
                    : "Unplaced"}
                </div>
              </div>

              {assembly.warnings.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {assembly.warnings.map((warning, index) => (
                    <div
                      key={`${warning.code}-${index}`}
                      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                    >
                      {warning.message}
                    </div>
                  ))}
                </div>
              ) : null}

              {assembly.lines.length > 0 ? (
                <div className="mt-3 overflow-auto">
                  <table className="data-table" data-testid="assembly-bom-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Rule</th>
                        <th>Qty</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembly.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <div className="font-semibold">{line.displayName}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {line.itemKey}
                            </div>
                          </td>
                          <td className="capitalize">
                            {ruleLabel(line.quantityRule)}
                          </td>
                          <td className="font-semibold">{formatQuantity(line)}</td>
                          <td>{line.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
