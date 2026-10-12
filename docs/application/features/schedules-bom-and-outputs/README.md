# 11 Schedules BOM and Outputs

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **11**. Previous area code: `EI-OUTPUT`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Produce readable engineering and material deliverables from the applicable drawing, catalogue and connectivity information without duplicating the underlying engineering records.

## Entry points

BOM Creator, Panel Analysis/report surfaces, connected schedules on drawing sheets, Package Preview, print and PDF provide different output paths.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 11.1 | Symbol Mini BOM | Reusable Item rows and quantity rules associated with a symbol. |
| 11.2 | Drawing BOM | Quantity projection from physical assets and applicable templates/components. |
| 11.3 | Panel schedules | Terminal, internal-wire, panel-asset and BOM report projections. |
| 11.4 | Connected Wire Schedule | An occurrence-linked table with layout controls and guarded continuation sheets. |
| 11.5 | Drawing presentation | Package Preview, printed sheets, title blocks and PDF output. |
| 11.6 | Deliverable exports | Format-specific report exports and draft/issued qualifications. |

## Engineering and behaviour boundaries

- A repeated occurrence must not automatically increase physical equipment quantity. Assembly/component expansion has its own quantity rules.
- Connected schedule rows are derived from canonical wires; moving or paginating a table does not create connectivity.
- Continuation-sheet cleanup must preserve user-customised sheets rather than silently deleting authored content.
- Document the source revision for each output: local draft, saved drawing, current catalogue templates or frozen report snapshot.
- A renderer's ability to produce SVG is not proof of a general user-facing SVG export command. The existing documents differ in scope; inspect each actual output surface.
- Do not imply saved BOM revisions, automatic cable lengths or issued-export eligibility beyond the current documented contracts.

## Implementation references

- [BOM Creator overview](../../../../src/features/bom_creator/README.md)
- [BOM asset/occurrence context](../../../../src/features/bom_creator/logic/services/bom-generation-context.ts)
- [Panel report overview](../../../../src/features/drawing_panel_reports/README.md)
- [Connected Wire Schedule overview](../../../../src/features/drawing_connected_wire_schedule/README.md)
- [Shared drawing SVG renderer](../../../../src/features/drawing_canvas/logic/services/drawing-svg-renderer.ts)
- [Drawing output routes](../../../../src/app/drawings/)

## Verification references

These are existing test locations, not results from this documentation pass.

- [BOM tests](../../../../src/features/bom_creator/tests/)
- [Panel report tests](../../../../src/features/drawing_panel_reports/tests/)
- [Connected schedule tests](../../../../src/features/drawing_connected_wire_schedule/tests/)
- [Connected schedule browser tests](../../../../tests/e2e/drawing-connected-wire-schedule.spec.ts)

## Related feature areas

- [6 Equipment and Asset Identity](../equipment-and-asset-identity/README.md)
- [4 Drawing Packages](../drawing-packages/README.md)
- [8 Wiring and Terminal Systems](../wiring-and-terminal-systems/README.md)
- [10 Engineering Analysis and Assurance](../engineering-analysis-and-assurance/README.md)

## Manual review

- [ ] Create a format-by-format matrix of entry points, source revisions and draft/issued restrictions.
- [ ] Review physical-asset deduplication, strip/component quantities and manual quantity cases.
- [ ] Verify which exports are exposed today rather than treating every renderer as a downloadable output.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
