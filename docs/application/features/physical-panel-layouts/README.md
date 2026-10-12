# 7 Physical Panel Layouts

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **7**. Previous area code: `EI-LAYOUT`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Develop a scaled mounting arrangement that shows where the selected equipment belongs inside a panel, while preserving its engineering identity and separating physical dimensions from drawing presentation.

## Entry points

Panel Layout work uses the drawing canvas, generated panel/backplane tools, equipment placement, associated-panel assets and the existing Properties cards.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 7.1 | Panels and backplanes | Enclosure occurrences, usable mounting dimensions and backplane geometry. |
| 7.2 | Scale and coordinates | Automatic/manual display scale and physical-to-sheet projection. |
| 7.3 | Equipment placement | True physical footprints, rotation, composition and existing-equipment references. |
| 7.4 | Rails and ducts | Automatically sized helpers and supported orientation/position editing. |
| 7.5 | Dimensions | Physical measurements, witness geometry and dimension-line presentation. |
| 7.6 | Device labels | Visibility, Compact/Standard/Large text, orientation, manual X/Y and optional leaders. |

## Engineering and behaviour boundaries

- Backplane scale and canvas zoom are different operations. Label font size is expressed in sheet units rather than scaled by equipment width.
- Current label documentation specifies Compact 2.0 sheet-mm regular text as the default, with 2.5 and 3.0 alternatives. Positioning remains manual; existing overlaps are not automatically resolved.
- Label leaders are optional visual annotations, not wires. Moving a tag must not move equipment or rename an asset.
- Physical placement does not automatically establish mounting-point alignment, manufacturer clearance compliance or engineering approval.
- Full-span helpers and fitted backplanes can constrain a placement axis; those constraints must be shown rather than presented as unrestricted movement.

## Implementation references

- [Canvas layout documentation](../../../../src/features/drawing_canvas/README.md)
- [Physical scale service](../../../../src/features/drawing_canvas/logic/services/drawing-backplane-scale.ts)
- [Shared label geometry](../../../../src/features/drawing_canvas/logic/services/drawing-layout-labels.ts)
- [Transient label overlay](../../../../src/features/drawing_canvas/ui/canvas/PanelLayoutLabelOverlay.tsx)
- [Associated equipment placement](../../../../src/features/drawing_panel_asset_placement/api/public.ts)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Label unit tests](../../../../src/features/drawing_canvas/tests/drawing-layout-labels.test.ts)
- [Layout movement tests](../../../../src/features/drawing_canvas/tests/drawing-layout-movement.test.ts)
- [Panel label browser tests](../../../../tests/e2e/drawing-panel-labels.spec.ts)

## Related feature areas

- [6 Equipment and Asset Identity](../equipment-and-asset-identity/README.md)
- [5 Canvas Authoring](../canvas-authoring/README.md)
- [8 Wiring and Terminal Systems](../wiring-and-terminal-systems/README.md)

## Manual review

- [ ] Confirm which layout checks are implemented and which remain an engineer's responsibility.
- [ ] Document panel, backplane and helper behaviour without treating every graphical helper as an asset.
- [ ] Review label size at intended output scale and document deliberate manual solutions for crowded tags.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
