# 12 Saving and Lifecycle Controls

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **12**. Previous area code: `EI-LIFE`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Make it clear when information is only a local edit, when it has been persisted, and which revision, lifecycle or read-only constraints protect existing work.

## Entry points

Drawing Save and status actions, modal Apply/Cancel, catalogue mutations and assurance revision workflows each have their own lifecycle.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 12.1 | Drawing drafts | Local model changes, dirty state, Apply semantics and pending previews. |
| 12.2 | Persistence and conflicts | Revision-aware drawing saves and failure recovery without silent overwrite. |
| 12.3 | History | Undo/redo for model commands and bounded interaction commits. |
| 12.4 | Status and read-only behaviour | Applicable review states, quality gates and protected editing surfaces. |
| 12.5 | Deletion and archive | Entity-specific removal restrictions rather than a universal delete rule. |
| 12.6 | Independent catalogue lifecycles | Item engineering snapshots, symbol availability and assurance records. |

## Engineering and behaviour boundaries

- A dialog Apply is not necessarily a database save. Drawing settings update a draft; catalogue rows may persist immediately.
- A revision conflict must not be described as a successful save. Detailed documentation must identify how the user preserves and retries changes.
- Transient placement and label previews are not committed output or stored engineering records.
- Drawing approval/status, symbol availability and recorded assurance review are not interchangeable concepts.
- Each entity's archive/delete behaviour needs its own documentation; do not infer that drawings, projects, Items and symbols share the same operations.
- Source-level guards and human engineering sign-off remain separate. This catalogue grants neither permission nor approval.

## Implementation references

- [Drawing actions and guards](../../../../src/features/drawing_canvas/api/actions.ts)
- [Drawing persistence](../../../../src/features/drawing_canvas/data/mutations.ts)
- [Save input contract](../../../../src/features/drawing_canvas/data/schema.ts)
- [Model history service](../../../../src/features/drawing_canvas/logic/services/drawing-model-history.ts)
- [Item revision contract](../../../../src/features/item_engineering/README.md)
- [Assurance lifecycle](../../../../src/features/standards_assurance/README.md)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Drawing feature tests](../../../../src/features/drawing_canvas/tests/)
- [Settings browser tests](../../../../tests/e2e/drawing-settings-dialog.spec.ts)
- [Item browser tests](../../../../tests/e2e/item-engineering.spec.ts)
- [Assurance browser tests](../../../../tests/e2e/standards-assurance.spec.ts)

## Related feature areas

- [4 Drawing Packages](../drawing-packages/README.md)
- [5 Canvas Authoring](../canvas-authoring/README.md)
- [2 Items and Engineering Information](../items-and-engineering-information/README.md)
- [10 Engineering Analysis and Assurance](../engineering-analysis-and-assurance/README.md)

## Manual review

- [ ] Build an entity-specific table of Apply, Save, immediate mutation, undo, archive and delete behaviour.
- [ ] Verify failure/conflict handling and read-only restrictions at both UI and server boundaries.
- [ ] Document the actual meaning of each status without claiming authenticated approval or multi-user collaboration where unsupported.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
