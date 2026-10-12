# EI Designer Feature Catalogue and Engineering System Reference

Maintained by **Specialist Commercial Solutions (SCS)**.

This catalogue explains what EI Designer does, the engineering information behind its capabilities, and where those capabilities are implemented. Start with the main register to review the proposed feature areas and open each overview.

**Document status:** Initial catalogue structure for manual review, created 30 September 2026. Feature-area boundaries and capability lists are provisional until reviewed. This is not a completed functional audit or an engineering approval.

## Start here

| Document | What to review |
| --- | --- |
| [Main feature register](REGISTER.md) | All 12 feature-area folders, their overview files and review status. |
| [Engineering system](engineering-system/README.md) | Shared identities, relationships, units, evidence and design sequence. |
| [Application architecture](architecture/README.md) | Mapping from the current 20 source modules to the feature areas. |
| [Guided authoring workflow](workflows/README.md) | The intended engineer-led workflow across the feature areas and its automation boundary. |

## How the catalogue is organised

A feature area is a group of related engineering capabilities. Its folder contains one main overview. That overview introduces the purpose, lists the capabilities to document in detail, identifies important boundaries, and links to implementation and test sources.

A capability is not simply a button, route or source folder. For example, Panel Device Labels includes size, orientation, manual positioning and leaders. Its controls belong together in one future detailed feature document.

This first delivery creates the area overviews, not separate documents for every sub-feature. The 12 main features and their 72 listed sub-features now have hierarchical numeric identifiers. Add a detailed capability file when its behaviour is reviewed and retain its allocated number. Do not create empty files for hypothetical capabilities.

## Feature numbering

Use dotted hierarchical identifiers throughout the catalogue:

| Level | Format | Meaning |
| --- | --- | --- |
| Main feature | `7` | Physical Panel Layouts. |
| Sub-feature | `7.6` | Device labels within Physical Panel Layouts. |
| Further sub-feature | `7.6.1` | A specific part of Device labels, allocated when documented. |
| Additional detail | `7.6.1.1` | A child of 7.6.1, if that level is needed. |

The last two rows demonstrate the format; they do not reserve undocumented features. There is no fixed maximum depth. Add a level only when it describes a meaningful capability, not simply because a document has another heading.

- Allocate each new child the next unused positive integer within its parent. Treat identifiers as sequences of integers, not decimal values: `7.10` follows `7.9`.
- Keep existing numbers stable when names, display order or folders change. New entries must not automatically renumber older ones.
- Never reuse a retired number. If a feature changes parent, record its former number and replacement explicitly and update references; do not silently reassign the old number.
- Use the same number in the register, overview, detailed feature title and cross-references. Generic documentation headings such as Purpose or Verification are not features and do not receive feature numbers.
- Preserve the former `EI-...` area codes as historical aliases in the overviews, not as a competing numbering scheme.
- Keep current descriptive folder names and links. Numbering does not require renaming the folders or moving application code.
- Engineering-system, architecture and workflow references are supporting documents, not additional numbered application features.

## What each detailed feature document will contain

1. Identity, purpose and scope.
2. Entry points, prerequisites, user workflow and resulting output.
3. Behaviour, defaults, validation, cancellation and error handling.
4. Engineering rules and information that must remain unchanged.
5. Data effects, including draft versus saved state, history, asset identity, wiring and BOM implications.
6. Dependencies on other features and shared engineering concepts.
7. Implementation links to relevant UI, services, contracts and persistence.
8. Acceptance criteria, test locations and dated verification evidence.
9. Current limitations and clearly separated future work.

Shared rules belong in the engineering-system reference. Feature documents explain their specific application without copying the whole shared definition.

## Evidence and status

The initial inventory used the active `codex/item-engineering` worktree, existing module documentation, route and source-file inspection. The base commit was `ed2dd594f7d094ee0e48f218b135bd3768e97057`. The worktree contained existing uncommitted changes; that commit alone does not reproduce the inspected application.

This pass did not run the application, execute functional tests, inspect production data or certify every behaviour described by older module documentation. Source links identify review starting points, not proof of complete implementation.

Keep these statuses separate in future detailed entries:

- **Implementation:** Planned, partial, implemented or retired, supported by current source and workflow evidence.
- **Verification:** Not assessed, or checked against a stated revision with dated results and remaining issues.
- **Engineering qualification:** The applicable evidence and human review; software availability or test success is not engineering approval.

For this initial register, every area is **source-mapped, with manual review and functional qualification pending**. No area has been awarded an overall implemented or verified status.

## Documentation boundaries

- This catalogue describes the product. It is separate from agent instructions and skills.
- Delivery plans record changes to be made; execution reports record historical checks. Neither automatically proves current behaviour.
- Source-module READMEs remain useful technical references. Where they disagree, record the discrepancy and verify current behaviour before claiming a resolution.
- EI SVG Generator is a separate application. This catalogue covers EI Designer's import and symbol-management boundary, not the generator's internal features.
- Keep catalogue changes versioned with the application. Do not maintain an independent workspace-root copy.

## Manual review

Open the register and each linked overview. Check names, group boundaries, missing capabilities and the stated limitations. Record decisions in the relevant overview and update its review status. Detailed feature descriptions and fresh behavioural verification follow that review.

Only documentation was added for this delivery. No application code, settings, storage, live drawing, runtime, agent instructions or delivery-plan status was changed.
