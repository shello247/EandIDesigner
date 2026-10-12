# 1 Projects and Clients

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **1**. Previous area code: `EI-PRJ`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Organise related drawing packages under a project and reusable client identity, while keeping project administration separate from printed engineering information.

## Entry points

Projects is the main navigation entry. Project detail provides access to linked drawings; client selection and creation are described by the project/client modules.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 1.1 | Project register | Finding projects, reviewing summaries and active or archived state. |
| 1.2 | Project details | Project identity, description, client assignment and lifecycle controls. |
| 1.3 | Linked drawings | Opening and managing drawing packages within the selected project. |
| 1.4 | Reusable clients | Creating and selecting client records without inventing a broader client-management system. |
| 1.5 | Project assignment | Recording package membership independently of printed title-block fields. |

## Engineering and behaviour boundaries

- Changing project membership must not silently rewrite the drawing's printed client or project/process text.
- New drawing creation requires project context in the current drawing contract; legacy data and archived-project compatibility need separate treatment.
- Project numbers, drawing numbers and equipment tags are different identifiers. Client administration beyond the documented surface must not be assumed.

## Implementation references

- [Project module overview](../../../../src/features/drawing_projects/README.md)
- [Client module overview](../../../../src/features/drawing_clients/README.md)
- [Project routes](../../../../src/app/projects/)
- [Drawing creation contract](../../../../src/features/drawing_canvas/data/schema.ts)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Project unit tests](../../../../src/features/drawing_projects/tests/)
- [Client unit tests](../../../../src/features/drawing_clients/tests/)
- [Project browser tests](../../../../tests/e2e/drawing-projects.spec.ts)

## Related feature areas

- [4 Drawing Packages](../drawing-packages/README.md)
- [12 Saving and Lifecycle Controls](../saving-and-lifecycle-controls/README.md)

## Manual review

- [ ] Confirm the scope of drawing deletion, project archive/restore and linked-drawing actions.
- [ ] Document exactly what happens when an existing drawing belongs to an archived project.
- [ ] Decide whether broader client administration belongs in the current inventory or the planned list.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
