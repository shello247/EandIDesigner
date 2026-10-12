# Engineering Attribute Workflow — User and Maintenance Guide

## Recording product information

Open an Item's **Engineering Attributes** tab. Add individual specifications, start from a template, or paste tab-separated rows. The table saves all changes as one engineering revision. A template supplies suggested field names, never product ratings. Device classification ranks suggestions; it cannot reject a valid environmental or installation specification by itself.

Use **Missing** or **Needs review** for unknown values. A blank numeric field is invalid while its status is Recorded; it never becomes zero. Changing a supported unit converts the entered value. AWG is a conductor designation with a dedicated conversion, not a linear multiplier. Absolute temperatures and temperature differences have separate dimensions.

For multiple ratings, identify their supply/channel/terminal scope, operating mode and condition. For example, external and chassis loop power are separate choices in a Loop power mode set. Two conflicting values for the same context remain visible and are unavailable to an unambiguous calculation.

Open **Evidence** to link a retained document or note with its page/section, an external URL or an engineer reference. A shared source is copied onto new draft rows; later changes to the shared selection cannot change saved provenance. **Details and type revision** holds optional custom labels and descriptions.

Edits survive Item tab changes and failed saves. If another change advances the revision, review the comparison, choose conflicting values, then explicitly save the combined draft. Archived Items remain readable. A newer catalogue/type revision does not rewrite historical Item revisions.

## Defining connections

In the same tab, define the product's physical terminals and channels. Give every terminal and channel a stable identity, a displayed number and a source-backed function. Mark unused terminals non-connectable. Channel memberships identify the terminals serving that channel; they do not electrically join them.

Set each membership's signal role explicitly for signal checks. A common/return connection must not be treated as a signal terminal merely because it belongs to a channel. Shared terminals require an explicit shared designation and supporting evidence. Isolation groups preserve the distinction between isolated channel commons.

The GRV-IMAI-8 acceptance fixture uses channel 0 terminals 1–3, channel 4 beginning at terminal 15, and non-connectable terminals 13/14. These are acceptance data, not defaults for other cards. Actual product onboarding remains an evidence-based content task.

## Qualifying a Symbol and choosing a product

On a Symbol's **Compatible Items** tab, add the exact Item engineering revision and identify whether the representation supports wiring, panel layout or both. Record the compatibility basis. Map product terminals to the Symbol's existing terminal keys. The qualification checks existing anchors and interface topology; it does not move artwork or remap existing wires.

Keep compatible alternatives separate from additional BOM parts. A selected primary product is never inferred from the first Mini BOM line. Common and option-specific additional parts follow the existing quantity rules.

On a drawing, choose the physical asset, terminal-strip member or nested component in **Selected product**. Review the terminal map and apply the product, then save the drawing. All graphical views of that physical identity share the selection. Independent physical devices can use different products even when they share a Symbol.

The inspector shows inherited manufacturer specifications and their exact saved sources. **Check newer Item revision** opens a comparison. A newer revision must be qualified against the Symbol before deliberate adoption. Existing drawings retain legacy values and BOM behaviour until explicitly configured.

## Installation settings and checks

Expand **Project settings, supply and assumptions** to select operating modes, a supply output, channel ranges, applicable conditions and terminal installation details. Save the drawing after applying settings. Manufacturer facts remain read-only; project assumptions do not overwrite their limits.

Power assignments are explicit. Chassis membership and physical proximity do not prove a supply connection. For each selected load, choose its supply, output identity and input scope. Enter a voltage only when its basis is known; an unsupported engineer-entered voltage makes the result provisional.

Open **Panel Analysis** for saved-drawing results:

- **Power Budgets** shows known load subtotal, capacity, remaining capacity and missing information. Alternate modes are excluded. W and VA stay separate. DC current/power conversion requires an applicable voltage. Missing loads prevent a complete verified result.
- **Error Detection** includes signal direction/type/range, terminal conductor/count/termination, physical dimension and check-specific information gaps. Existing occupancy checks remain in place.
- **I/O Schedule** uses explicit channel and terminal identities, selected ranges, mapped Symbol terminals and canonical landed wires. Search, inspect sources or export CSV. A membership does not establish continuity.

Verified means sufficient supported inputs for that particular calculation, not engineering approval. Assumptions make results provisional. Missing facts or unsupported calculations remain unavailable/partial coverage. Source links retain the selected historical content identity.

## Boundaries

This release does not design a rack graphically, extract facts from PDFs, infer protection coordination, simulate thermal behaviour or grant engineering approval. Nested positions support independent product identities, inheritance, fixed BOM parts and explicit power assignment. Where the existing nested artwork has no canonical terminal projection, wiring-dependent checks and connection-count quantities report insufficient information; they do not invent connectivity. Use established managed equipment identities for wired devices until that separate projection is available.

The release preserves drawing geometry, anchor coordinates and existing wires. No automatic product selection or silent conversion of ambiguous catalogue text is performed. New typed definitions coexist with historical text definitions.

## Qualification and maintenance

Implementation lives in the local `engineering-attributes` worktree. The canonical `EI_Designer` repository remains on main. Development startup uses `npm run dev:webpack`, which resolves canonical storage explicitly. Do not set a relative live `DATABASE_URL` or run a qualification build in the active shared runtime.

Run unit, lint, type and dependency checks from the implementation checkout. Browser/build verification uses the registered synthetic `test-engineering-attributes.db` through `scripts/drawing-performance-audit/run-command.mjs` and localhost:3100. Use a fresh `AUDIT_PHASE` each run to preserve evidence.

The offline schema upgrade and catalogue reconciliation tools produce separate verified backups and receipts. The schema change is additive. Catalogue upgrades add definitions or immutable type revisions; record reconciliation is a review preview and never rewrites Item profiles. Recovery requires stopping the server, preserving the current database and sidecars, checking backup identity/integrity and restoring the matching pre-maintenance snapshot before restarting the matching source baseline. Exact cutover evidence belongs in the qualification report.
