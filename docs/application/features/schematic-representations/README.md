# 9 Schematic Representations

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **9**. Previous area code: `EI-SCHEM`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Provide an alternate electrical presentation of supported drawing information without changing the original drawing model, physical identity or canonical connectivity.

## Entry points

The inspected drawing representation control is a labelled View dropdown with Outline and Schematic Preview choices. A separate Standards schematic demonstrator has its own presentation.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 9.1 | View selection | Switching supported working sheets between the original outline and read-only preview. |
| 9.2 | Source adaptation | Resolving exact symbols, assets, terminals and wires into projection input. |
| 9.3 | Generic representations | Supported original schematic artwork and visible mapping gaps. |
| 9.4 | Connectivity comparison | Endpoint identity checks, unresolved cases and disclosed off-sheet information. |
| 9.5 | Embedded controls | Preview-specific controls without changing the hidden outline viewport. |
| 9.6 | Standalone demonstration | Synthetic sample, comparison information and provisional SVG output. |

## Engineering and behaviour boundaries

- Preview is read-only and is not an authoritative IEC-conformance implementation or construction approval.
- The schematic source can include current unsaved drawing data; it must not silently save or replace the original drawing.
- Physical mounting layout and electrical schematic conversion are different responsibilities. Do not assume all sheet types support meaningful conversion.
- The documented limitations include incomplete specialised mappings, structural-pattern/cross-sheet rendering and authoritative standards review.
- The older schematic README describes a button row; the inspected editor component now uses a dropdown. Describe embedded and standalone controls separately and verify their current restrictions.

## Implementation references

- [Schematic overview and limits](../../../../src/features/schematic_preview/README.md)
- [Current representation selector](../../../../src/features/drawing_canvas/ui/components/drawing-representation-control.tsx)
- [Drawing integration](../../../../src/features/drawing_canvas/ui/components/drawing-schematic-preview.tsx)
- [Detailed Panel adapter](../../../../src/features/drawing_canvas/logic/services/drawing-panel-schematic-source.ts)
- [Standalone demonstrator route](../../../../src/app/standards/schematic-demo/page.tsx)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Projection tests](../../../../src/features/schematic_preview/tests/)
- [Drawing adapter tests](../../../../src/features/drawing_canvas/tests/drawing-schematic-preview.test.ts)
- [Embedded toolbar browser coverage](../../../../tests/e2e/drawing-canvas-toolbar.spec.ts)

## Related feature areas

- [8 Wiring and Terminal Systems](../wiring-and-terminal-systems/README.md)
- [5 Canvas Authoring](../canvas-authoring/README.md)
- [10 Engineering Analysis and Assurance](../engineering-analysis-and-assurance/README.md)

## Manual review

- [ ] Verify supported sheet types and the conditions disabling view changes.
- [ ] Keep preview zoom, outline zoom and their preserved state clearly distinguished.
- [ ] Identify current generic mappings versus planned authoritative representations and their evidence requirements.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
