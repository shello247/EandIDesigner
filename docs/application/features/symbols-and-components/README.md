# 3 Symbols and Components

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **3**. Previous area code: `EI-SYM`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Maintain reusable drawing representations and structured metadata so equipment can be depicted, sized, composed and connected without confusing artwork with engineering identity.

## Entry points

Symbols provides the registry, New symbol opens SVG import, and symbol detail exposes representation information and Mini BOM relationships.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 3.1 | Registry and versions | Symbol identity, stored artwork, available versions and exact-version use. |
| 3.2 | SVG import | Sanitisation, viewBox information and supported metadata/anchor interpretation. |
| 3.3 | Terminal definitions | Logical terminals, anchors and electrical capabilities separate from visual markings. |
| 3.4 | Physical metadata | Dimensions, layout usage, mounting and resizing capabilities. |
| 3.5 | Components and Device Types | Configured composition and controlled, exact-version classification. |
| 3.6 | Artwork replacement and Item links | Controlled artwork changes and symbol Mini BOM links to catalogue Items. |

## Engineering and behaviour boundaries

- Artwork acceptance, Item linkage, wiring readiness and engineering approval are separate outcomes.
- PLAN-015 controlled Device Types are live locally from 8 October 2026, replacing editable Symbol categories in the interface. Historical categories remain read-only evidence. Technical behaviour still depends on explicit metadata and capabilities, not a folder or type alone. Legacy versions remain visibly Needs classification until source-backed correction; the manufacturer audit is not complete. See the [classification procedure](../../../../src/features/device_classification/README.md).
- The separate EI SVG Generator application is outside this catalogue. Its exported artwork enters EI Designer through the supported import/replacement boundary.
- Existing documentation disagrees on symbol approval: the import README describes approval, while the registry README describes immediate availability after valid save/import and a legacy status token. Verify the current workflow before writing procedural instructions.

## Implementation references

- [Registry overview](../../../../src/features/symbol_registry/README.md)
- [Import overview with lifecycle caveat](../../../../src/features/svg_symbol_import/README.md)
- [Components overview](../../../../src/features/symbol_components/README.md)
- [Categories overview](../../../../src/features/symbol_categories/README.md)
- [Artwork replacement workflow](../../../../src/features/symbol_registry/ui/components/replace-artwork-dialog.tsx)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Registry tests](../../../../src/features/symbol_registry/tests/)
- [Component tests](../../../../src/features/symbol_components/tests/)
- [Artwork replacement browser tests](../../../../tests/e2e/symbol-artwork.spec.ts)

## Related feature areas

- [2 Items and Engineering Information](../items-and-engineering-information/README.md)
- [7 Physical Panel Layouts](../physical-panel-layouts/README.md)
- [8 Wiring and Terminal Systems](../wiring-and-terminal-systems/README.md)

## Manual review

- [ ] Resolve the lifecycle wording conflict without treating a legacy status token as human engineering approval.
- [ ] Document which edits affect the current version and which create or select another version.
- [ ] Review replacement-artwork protections for terminals, dimensions, component metadata and Item links.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
