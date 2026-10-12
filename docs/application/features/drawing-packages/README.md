# 4 Drawing Packages

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **4**. Previous area code: `EI-PKG`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Structure the engineering deliverable as an ordered package with shared drawing information, a Title Sheet, named sections and the working sheets needed for the design.

## Entry points

Create a drawing from its project. Use the drawing header, Drawing Settings and Sheet Loader to manage package information and sheet structure.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 4.1 | Shared drawing information | Drawing title, description, project assignment, units and printed title-block fields. |
| 4.2 | Package Title Sheet | A package-wide cover displayed in the expanded Package Information group, using existing shared information. |
| 4.3 | Sections | Add Section creates a named section with its own title page; numbering begins at 1, independently of Package Information. |
| 4.4 | Sheet management | Add Sheet selects an existing section or creates one with its first working sheet. Naming, selecting, explicit movement and removal retain supported sheet-type restrictions. |
| 4.5 | Drawing Settings | General and Printed Title Block editing, including reviewed project-detail copying. |
| 4.6 | Package presentation | Sheet identity and order supplied consistently to preview and drawing output. |

## Engineering and behaviour boundaries

- The intended authoring sequence is Title Sheet, named section with its Section Title Page, then working sheets. **Package Information** replaces the former Front Matter display name; it is not Section 1 and does not substitute for an engineering section.
- The package Title Sheet applies to all sections. New sections append after existing sheets, preserving existing section numbers until the engineer deliberately reorders them.
- Existing working sheets before the first section are marked **Needs section**, without being moved or changed. Use the sheet's actions to move it into a named section. Merely opening the drawing or loader does not save or change its structure.
- A working sheet requires a named section destination. Adding a new section and its first sheet is one undoable local-draft action; Cancel adds neither. Package Information is not offered as a working-sheet destination.
- Printed client/project information is separate from organisational project assignment. Explicit copying must preserve unrelated fields and missing-source values.
- Drawing Settings Apply changes the local drawing draft; Save is a separate persistence step.
- Sheet copy and deletion semantics depend on sheet type and physical-reference rules; they must not be described as unrestricted duplication.

## Implementation references

- [Drawing package overview](../../../../src/features/drawing_canvas/README.md)
- [Package schema](../../../../src/features/drawing_canvas/data/schema.ts)
- [Sheet Loader](../../../../src/features/drawing_canvas/ui/components/sheet-loader-dialog.tsx)
- [Drawing Settings](../../../../src/features/drawing_canvas/ui/components/drawing-settings-dialog.tsx)
- [Shared title fields](../../../../src/features/drawing_canvas/logic/services/drawing-title-fields.ts)
- [Section destination validation](../../../../src/features/drawing_canvas/logic/services/drawing-sheet-destination.ts)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Title Sheet tests](../../../../src/features/drawing_canvas/tests/drawing-title-sheet.test.ts)
- [Sheet management browser tests](../../../../tests/e2e/drawing-sheet-management.spec.ts)
- [Package Information browser tests](../../../../tests/e2e/drawing-package-information.spec.ts)
- [Section destination unit tests](../../../../src/features/drawing_canvas/tests/drawing-sheet-destination.test.ts)
- [Settings browser tests](../../../../tests/e2e/drawing-settings-dialog.spec.ts)

## Related feature areas

- [1 Projects and Clients](../projects-and-clients/README.md)
- [5 Canvas Authoring](../canvas-authoring/README.md)
- [12 Saving and Lifecycle Controls](../saving-and-lifecycle-controls/README.md)

## Manual review

- [ ] Confirm names and prerequisites for every current sheet type.
- [ ] Document section movement/removal and title-sheet conversion conditions separately.
- [ ] Verify which package information each editor reads and updates without introducing duplicate data.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
