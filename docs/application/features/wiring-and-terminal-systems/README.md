# 8 Wiring and Terminal Systems

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **8**. Previous area code: `EI-WIRE`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Define and display electrical relationships between identified equipment terminals, preserving canonical connectivity across panel views, routes and schedules.

## Entry points

Ordinary drawing connection tools, Detailed Panel sheets, the Panel Engineering Workbench, Terminal Strip Builder and Wire Catalog support related but distinct workflows.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 8.1 | Terminal definitions and occupancy | Logical terminal identity, physical sides, ambiguity and landing conflicts. |
| 8.2 | Field connections | Source connections, cable/conductor information and external-termination mapping. |
| 8.3 | Detailed Panel equipment | Existing equipment references and terminal review before internal wiring. |
| 8.4 | Internal wires and routes | Canonical endpoints, permanent wire numbering, specification snapshots and graphical representations. |
| 8.5 | Connection patterns | Jumpers, bridges, distributions, shielding and earthing with distinct record semantics. |
| 8.6 | Terminal strips | Structured composition, stable member identity, independent copies and linked representations. |
| 8.7 | Wire Catalog | Reusable type/size/colour combinations and immutable snapshots on wires. |

## Engineering and behaviour boundaries

- Displayed route geometry never substitutes for canonical terminal or wire identity. Removing a route and deleting a physical wire are different operations.
- Detailed Panel discovery references existing panel equipment; it does not implicitly create another breaker, controller or terminal asset.
- Internal wire numbers follow a permanent, non-reused sequence in the documented contract. This differs from equipment tag gap reuse.
- Structured member tokens remain stable when strip members are reordered. Copying another physical strip does not prove electrical equivalence or copy its wiring.
- Structural connections and annotation/reference helpers must not create fake physical wire or equipment quantities.
- Feature availability and read-only controls can depend on the Detailed Panel release configuration; this inventory does not inspect or change it.

## Implementation references

- [Panel wiring overview](../../../../src/features/drawing_panel_wiring/README.md)
- [Terminal strip overview](../../../../src/features/drawing_terminal_blocks/README.md)
- [Wire Catalog overview](../../../../src/features/wire_catalog/README.md)
- [Panel wiring public API](../../../../src/features/drawing_panel_wiring/api/public.ts)
- [Detailed Panel release guidance](../../../../docs/DETAILED_PANEL_RELEASE.md)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Panel wiring tests](../../../../src/features/drawing_panel_wiring/tests/)
- [Terminal-strip tests](../../../../src/features/drawing_terminal_blocks/tests/)
- [Wire Catalog tests](../../../../src/features/wire_catalog/tests/)
- [Terminal occupancy browser tests](../../../../tests/e2e/drawing-terminal-occupancy.spec.ts)

## Related feature areas

- [6 Equipment and Asset Identity](../equipment-and-asset-identity/README.md)
- [9 Schematic Representations](../schematic-representations/README.md)
- [10 Engineering Analysis and Assurance](../engineering-analysis-and-assurance/README.md)
- [11 Schedules BOM and Outputs](../schedules-bom-and-outputs/README.md)

## Manual review

- [ ] Separate ordinary field-wiring, internal-wire and structural-pattern contracts in the detailed inventory.
- [ ] List supported terminal-side operations and the exact cases rejected as ambiguous.
- [ ] Document route deletion, physical deletion, assembly copying and reference reuse independently.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
