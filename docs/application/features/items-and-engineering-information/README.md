# 2 Items and Engineering Information

Maintained by **Specialist Commercial Solutions (SCS)**. Feature **2**. Previous area code: `EI-ITEM`. Initial overview dated 30 September 2026; awaiting engineer review.

[Main register](../../REGISTER.md) · [Catalogue home](../../README.md) · [Engineering system](../../engineering-system/README.md)

## Purpose

Maintain reusable product records together with the engineering facts, manufacturer evidence and commercial information needed to select and document equipment.

## Entry points

Items Library provides the register and creation workflow. Item detail combines general identity, engineering attributes, Engineer Notes, documents, commercial information and symbol usage.

## Numbered sub-features

The following list is grounded in the linked source and module documentation. It is a starting inventory, not a claim that every workflow has been freshly tested. Sub-feature numbers extend this feature's number; deeper levels append another segment. Follow the [catalogue numbering rules](../../README.md#feature-numbering).

| Number | Sub-feature | Scope |
| --- | --- | --- |
| 2.1 | Product catalogue | Item identity, manufacturer/model data, descriptions, images and lifecycle. |
| 2.2 | Engineering attributes | Typed facts, controlled units, classifications, conditions and applicability. |
| 2.3 | Evidence and guidance | Engineer Notes, image snippets and linked PDF documents. |
| 2.4 | Engineering revisions | Exact historical profiles and references, with conflict-aware updates. |
| 2.5 | Commercial information | Cost and supplier information kept distinct from electrical revisions. |
| 2.6 | Symbol usage and product extraction | Mini BOM relationships and explicit assisted product-information extraction. |
| 2.7 | Controlled Device Types | Shared types, including UPS and Chassis / Rack; an explicitly selected exact Item revision supplies product classification. Software live on 8 October 2026; existing-record engineering revalidation remains pending. |

## Engineering and behaviour boundaries

- An Item record, available symbol or Mini BOM link does not establish complete engineering data or product suitability.
- Unknown values must remain unknown. Conductor ranges, operating ratings and installed wire sizes are different facts.
- Document Item save behaviour independently from drawing Save. Engineering, commercial and guidance changes have distinct revision effects.
- The module documentation explicitly leaves some configuration/selection integration to later work; do not describe that programme as universally complete.

## Implementation references

- [Items Library and BOM ownership](../../../../src/features/bom_creator/README.md)
- [Item engineering overview](../../../../src/features/item_engineering/README.md)
- [Attribute definitions](../../../../src/features/engineering_attributes/README.md)
- [Item workspace route](../../../../src/app/bom/items/)

## Verification references

These are existing test locations, not results from this documentation pass.

- [Item engineering unit tests](../../../../src/features/item_engineering/tests/)
- [Attribute unit tests](../../../../src/features/engineering_attributes/tests/)
- [Item browser tests](../../../../tests/e2e/item-engineering.spec.ts)

## Related feature areas

- [3 Symbols and Components](../symbols-and-components/README.md)
- [6 Equipment and Asset Identity](../equipment-and-asset-identity/README.md)
- [11 Schedules BOM and Outputs](../schedules-bom-and-outputs/README.md)

## Manual review

- [ ] Separate reusable type definitions from Item-specific values and drawing-specific values.
- [ ] Review exact-product configuration and historical selection support before describing it as implemented.
- [ ] Document onboarding completeness, required supporting components and unresolved evidence independently of catalogue status.

**Review status:** Pending. Detailed capability files and current functional qualification have not yet been completed. Record confirmed behaviour, gaps and planned work separately when expanding this area.
