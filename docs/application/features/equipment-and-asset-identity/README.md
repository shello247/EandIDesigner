# 6 Equipment and Asset Identity

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **6**. Previous area code: `EI-ASSET`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Represent each physical device or managed assembly consistently across its inventory record, layout and electrical views without creating duplicate equipment.

## Entry points

Asset Manager, selected-occurrence Asset Identity controls and existing-equipment placement workflows expose different parts of the same package-level identity model.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 6.1 | Managed inventory | Package assets, engineering types, tags and sheet associations. |
| 6.2 | Unplaced equipment | Assets recorded before a graphical occurrence is added. |
| 6.3 | Occurrences and references | Multiple representations of one physical asset across appropriate sheets. |
| 6.4 | Panel ownership | Containment and eligible panel/backplane placement targets. |
| 6.5 | Identity and configuration | Pinned symbol versions, installed components and applicable engineering attributes. |
| 6.6 | Safe copy and removal | Distinguishing independent equipment copies, reference removal and physical-asset deletion. |
| 6.7 | Device Type resolution and review | Exact Item/Symbol provenance, visible conflicts and explicit classification-only snapshot repair. Software live on 8 October 2026; legacy-record reconciliation and manufacturer review remain pending. |

## Engineering and behaviour boundaries

- An asset ID is not an occurrence ID. Deleting one representation must not be described as deleting its physical asset unless that command explicitly does so.
- Tags are package identifiers, while source versions and component selections carry separate configuration information.
- References must preserve physical identity and applicable ownership. They must not inflate physical BOM quantities merely because they add another picture.
- Structured terminal-strip members remain nested in their parent assembly; they are not ordinary independent Asset Manager rows.
- Appearance belongs to the relevant drawing occurrence unless the feature explicitly edits shared asset information.
- Classification review must preserve the asset tag, physical identity, geometry, wires, product pins and quantities. Approved/archived drawings receive findings, not automatic corrections. See the [repeatable audit procedure](../../../../src/features/device_classification/README.md).

## Implementation references

- [Asset Manager overview](../../../../src/features/drawing_asset_manager/README.md)
- [Public asset contracts](../../../../src/features/drawing_canvas/api/asset-contracts.ts)
- [Associated placement public API](../../../../src/features/drawing_panel_asset_placement/api/public.ts)
- [Detailed Panel representation rules](../../../../src/features/drawing_panel_wiring/README.md)
- [Structured strip identity](../../../../src/features/drawing_terminal_blocks/README.md)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Asset Manager tests](../../../../src/features/drawing_asset_manager/tests/)
- [Associated asset tests](../../../../src/features/drawing_panel_asset_placement/tests/)
- [Panel occurrence tests](../../../../src/features/drawing_canvas/tests/drawing-panel-occurrence-commands.test.ts)

## Related feature areas

- [2 Items and Engineering Information](../items-and-engineering-information/README.md)
- [7 Physical Panel Layouts](../physical-panel-layouts/README.md)
- [8 Wiring and Terminal Systems](../wiring-and-terminal-systems/README.md)
- [11 Schedules BOM and Outputs](../schedules-bom-and-outputs/README.md)

## Manual review

- [ ] Document ownership and lifecycle separately for physical assets, helpers and occurrences.
- [ ] Review all copy/reference entry points for consistent wording and identity effects.
- [ ] Map product-selection and engineering-revision integration only where current implementation supports it.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
