# Schematic Preview

Read-only demonstration of overview-to-schematic representation using original, generic artwork and general engineering conventions. It is not an IEC-conformance implementation and does not contain purchased standards or extracted symbol collections.

## Try it

Open `/standards/schematic-demo`. Switch **Outline View / Schematic Preview**, compare views, select a wire in the endpoint table, or download the provisional SVG. The synthetic 24 VDC example contains six devices, 25 terminals and five explicit wires; it is not a manufacturer drawing or a saved project.

Working drawing sheets expose **Outline View / Schematic Preview** immediately below the active drawing-panel heading. Outline View is the original approved-symbol canvas, never the synthetic sample. Preview consumes the current editor model (including unsaved changes), preserving the mounted original editor. It has no save/mutation action or database dependency. Returning to Outline retains the draft.

## Scope and integrity

- Zod-validated DTOs; drawing_canvas owns the source adapter and uses exact pinned symbol versions.
- Preserves placement, asset, terminal, anchor and wire identity. Known permanent continuity is copied explicitly. Positional proximity and tags do not create connections.
- Endpoint equivalence checks compare complete wire identities and endpoint pairs. Missing/ambiguous endpoints and duplicate identities cannot pass. Empty circuits remain incomplete.
- Specialized generic representations: terminal blocks and power supplies. Other devices remain labelled functional blocks with a visible mapping gap.
- Detailed Panel sheets check displayed routes against canonical wire records and exact asset/terminal/side pairs. Missing records, mismatched sides and same-sheet wires without routes prevent a complete endpoint assessment. Off-sheet wires are disclosed separately; structural pattern and cross-sheet rendering remain future work. Physical mounting layouts are outside electrical conversion scope.
- SVG/XML text is escaped; source artwork is never inserted into this renderer. Provisional labels and provenance remain in exported SVG.
- Deterministic layout, original source-relative columns, orthogonal routes. Complex circuit routing, cross-sheet references, IEC reference designations, manual schematic placement and construction exports are future work.
- Preview is neither an assurance evidence record nor an engineering approval. Existing standards candidates remain candidates.

## Verification

In the registered `schematic-preview` linked worktree:

```text
node scripts/schematic-preview/run.mjs test src/features/schematic_preview/tests src/features/drawing_canvas/tests/drawing-schematic-preview.test.ts
node scripts/schematic-preview/run.mjs lint
node scripts/schematic-preview/run.mjs typecheck
node scripts/schematic-preview/run.mjs bootstrap
node scripts/schematic-preview/run.mjs build
node scripts/schematic-preview/run.mjs browser
```

The runner selects only its own synthetic database and probes port 3120 before a test server. Logs/screenshots/traces stay under `artifacts/schematic-preview`. No production records are created by browser tests.

## Moving to authoritative representations

Keep the source DTO/canonical engineering model stable. Introduce reviewed representation revisions with exact symbol-entry references, explicit pin maps and stated applicability. Tie those representations to Standards & Assurance requirements, evidence and reviews. Obtain the appropriate permissions before integrating licensed standard content or symbol collections. Expand canonical panel-wire projection separately, then qualify the electrical-equivalence checks and presentation rules before changing status labels.
