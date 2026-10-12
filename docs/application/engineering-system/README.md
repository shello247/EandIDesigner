# EI Designer Engineering System

Maintained by **Specialist Commercial Solutions (SCS)**. Initial reference, 30 September 2026; awaiting engineer review.

[Catalogue home](../README.md) · [Main register](../REGISTER.md) · [Architecture](../architecture/README.md)

This reference explains the shared concepts that individual features must use consistently. It is an initial documentation of the engineering model and intended workflow, not a finding that every safeguard is automatically enforced.

## Core concepts

| Concept | Meaning and important boundary |
| --- | --- |
| Project and Client | Organisational records for related drawing packages. Project assignment and printed title-block text are separate concerns. |
| Item | A reusable purchasable or consumable catalogue product. Its engineering information and evidence are distinct from its commercial details. |
| Symbol and version | Drawing artwork with structured metadata, including applicable physical dimensions and electrical terminals. Artwork alone does not establish wiring readiness. |
| Managed asset | The identity of a physical device or managed assembly within a drawing package. Multiple occurrences do not necessarily mean multiple physical devices. |
| Drawing occurrence | A representation of an asset on a sheet. Position, presentation and representation-specific labels belong to this drawing context. |
| Terminal | A logical connection point belonging to an asset, including a side where the wiring contract requires one. An SVG anchor supplies geometry, not a replacement physical identity. |
| Canonical connection or wire | The engineering record of connectivity. A displayed route is a representation of that record; proximity never creates connectivity. Ordinary field connections and internal panel wires have different storage contracts. |
| Drawing package | Shared package information and ordered sheets. Sections are derived from Section Title Page boundaries. |
| Physical layout | A scaled representation of equipment and mounting geometry. A backplane/helper is not automatically an additional physical asset. |
| Derived output | A report, schedule, preview or BOM projection built from source records. It must not silently create alternative equipment or connection identities. |

## Design sequence

The intended new-panel workflow is:

1. Select exact equipment, quantities and intended roles.
2. Review manufacturer requirements, Item attributes, notes and documents; identify required protection, accessories and unresolved conditions.
3. Complete the equipment list and establish enclosure, usable mounting area, equipment dimensions, mounting methods and clearances.
4. Create and review the physical mounting layout with the engineer.
5. Develop internal wiring using the same managed equipment identities.
6. Review findings and produce the applicable drawing and material outputs.

This is a working methodology, not a claim that EI Designer currently implements a mandatory workflow engine. Existing-panel or narrowly scoped work can reuse established information instead of restarting the sequence.

Package authoring follows Title Sheet, named section with its Section Title Page, then working sheets in that section. Physical layout normally precedes internal wiring in the panel-development package. Explicit engineer decisions can define a different appropriate scope.

## Identity and quantities

An Item link, a Symbol, an asset and an occurrence answer different questions: what product, what representation, which physical device, and where it is shown. A symbol Mini BOM is not by itself a verified product-configuration or compatibility decision.

Asset tags and wire numbers also have different allocation rules. Do not generalise the equipment gap-reuse rule to wire numbering. Each detailed feature must document its own allocator and identity boundaries.

Independent equipment copies and references must be distinguished. One creates another physical device; the other creates another view of the same device. Report quantities must follow the applicable physical identity and quantity rules rather than simply counting artwork.

## Geometry and units

Physical millimetres, sheet coordinates and screen pixels are different coordinate systems. Backplane scale projects physical geometry into a sheet; canvas zoom magnifies the view. Annotation size need not scale with the device's physical mounting scale.

Terminal placement in artwork must be traceable to the electrical definition. Text labels, guide lines, leaders and visual grouping do not establish electrical relationships.

## Evidence and unknowns

Unknown ratings remain unknown, not zero or a guessed value. Manufacturer applicability, exact order codes, supply variants, terminal conditions and source revisions matter. An attractive symbol, available Item or successful software save is not evidence of complete engineering information.

Distinguish software checks, recorded review, authoritative source review and engineering approval. Standards bibliographic records are not proof that normative clauses have been reviewed or implemented.

## Drafts and saved information

Drawing edits generally work on a local model until Save. Catalogue editing and assurance records have their own persistence and revision contracts. Do not promise one universal save or undo behaviour across all workspaces.

Analysis and outputs must state whether they use the current local draft, the saved drawing or a frozen snapshot. The detailed feature entry must identify that source explicitly.

## Source map

- [Drawing model and schema](../../../src/features/drawing_canvas/data/schema.ts)
- [Asset Manager](../../../src/features/drawing_asset_manager/README.md)
- [Panel wiring identities and graph](../../../src/features/drawing_panel_wiring/README.md)
- [Item engineering](../../../src/features/item_engineering/README.md)
- [Engineering attributes](../../../src/features/engineering_attributes/README.md)
- [Standards and Assurance](../../../src/features/standards_assurance/README.md)

## Review next

Confirm this terminology and the workflow boundaries. Then expand only the concepts needed by reviewed feature documents, with source-backed examples and explicit enforcement gaps.
