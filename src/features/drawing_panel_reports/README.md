# Drawing Panel Reports

`drawing_panel_reports` derives terminal, internal-wire, panel-asset, and BOM
deliverables from the public Detailed Panel connectivity graph. Report rows are
read-only, deterministic, and never persisted into drawing JSON.

The feature owns report schemas, schedule builders, table/export projections, and
schedule print rendering. BOM item/template expansion remains owned by
`bom_creator`; drawing and connectivity ownership remains with `drawing_canvas`
and `drawing_panel_wiring`.

Draft exports are available with QC findings. Issued exports require an approved
drawing and a fresh package QC report without blocking findings.

## Performance And Public Boundaries

All schedules in one bundle share a `PanelReportIndex`. Routes, patterns,
terminations, occurrences, terminal counts, conductor relationships, and QC
findings are indexed once; report rows do not rescan the package. Panel Analysis
reuses the same saved-revision index for its terminal, wire, asset, and lazy BOM
sections.

Tables use deferred search and bounded pagination. ExcelJS remains server-only.
CSV/XLSX/PDF routes rebuild from the saved server revision.

The BOM boundary is the neutral `BomAssemblyProjection` plus
`generateBomFromProjection`. This feature does not import BOM Creator internals
or create duplicate item records.

## Verification

```powershell
npm run test -- src/features/drawing_panel_reports/tests/panel-schedules.test.ts
npm run test -- src/features/drawing_panel_reports/tests/panel-export.test.ts
npm run test:panel-perf
npm run lint
```
