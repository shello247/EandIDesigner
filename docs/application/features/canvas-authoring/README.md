# 5 Canvas Authoring

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **5**. Previous area code: `EI-CANVAS`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Provide deliberate, reversible drawing interaction while keeping transient previews and viewport controls separate from committed engineering content.

## Entry points

The active drawing sheet in Outline view provides the fixed toolbar, Add menu, symbol library and Properties controls. Schematic Preview has a separate read-only role.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 5.1 | Viewport | Fit, zoom, pointer-anchored wheel zoom, scrolling, panning and guides. |
| 5.2 | Cursor placement | Choose, configure when necessary, preview and click to place. |
| 5.3 | Repeated placement | Ctrl+click continuation, package numbering, cancellation and reference restrictions. |
| 5.4 | Selection and editing | Supported dragging, rotation, resizing, nudge and property changes. |
| 5.5 | Clipboard and annotations | Copy/paste rules, notes and non-electrical callouts. |
| 5.6 | History and interaction safety | Undo/redo, gesture cancellation, modal isolation and read-only restrictions. |

## Engineering and behaviour boundaries

- The inspected placement instructions show Click to place once, Ctrl+click for supported multiple placement, and Esc to cancel. The old repeat toggle and Finish button are not the intended workflow.
- Pending previews must not consume equipment tags, alter BOM quantities or appear in saved/exported output.
- Interactive placement must not silently relocate equipment. A valid position is not manufacturer-clearance approval.
- Canvas history is not a universal undo mechanism for catalogue records or assurance transactions.
- Wire routing, physical layout labels and schematic projection have their own feature-specific rules and should be linked rather than duplicated here.

## Implementation references

- [Canvas overview](../../../../src/features/drawing_canvas/README.md)
- [Placement instructions](../../../../src/features/drawing_canvas/ui/canvas/PlacementInstructions.tsx)
- [Placement service](../../../../src/features/drawing_canvas/logic/services/drawing-placement.ts)
- [Viewport geometry](../../../../src/features/drawing_canvas/logic/services/viewport-transform.ts)
- [Drawing history](../../../../src/features/drawing_canvas/logic/services/drawing-model-history.ts)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Placement unit tests](../../../../src/features/drawing_canvas/tests/drawing-placement.test.ts)
- [Placement browser tests](../../../../tests/e2e/drawing-cursor-placement.spec.ts)
- [Toolbar browser tests](../../../../tests/e2e/drawing-canvas-toolbar.spec.ts)

## Related feature areas

- [7 Physical Panel Layouts](../physical-panel-layouts/README.md)
- [8 Wiring and Terminal Systems](../wiring-and-terminal-systems/README.md)
- [12 Saving and Lifecycle Controls](../saving-and-lifecycle-controls/README.md)

## Manual review

- [ ] Inventory supported gestures and shortcuts by tool, rather than promising every gesture everywhere.
- [ ] Document ordinary, generated, reference and queued-placement differences.
- [ ] Recheck zoom, focus, cancellation and history on synthetic fixtures before assigning a verification status.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
