# EI Designer Guided Authoring Workflow

Maintained by **Specialist Commercial Solutions (SCS)**. Initial workflow overview, 30 September 2026; awaiting engineer review.

[Catalogue home](../README.md) · [Main register](../REGISTER.md) · [Engineering system](../engineering-system/README.md)

The product goal is for an engineer to describe a design in conversation and iteratively develop the actual EI Designer drawing with assistance. This is a cross-feature workflow, not evidence that the application already provides a complete autonomous design engine.

## Intended sequence and supporting features

| Stage | Engineer and application outcome | Catalogue reference |
| --- | --- | --- |
| Establish scope | Select the project, intended package and design purpose | [1 Projects](../features/projects-and-clients/README.md) and [4 Packages](../features/drawing-packages/README.md) |
| Select equipment | Identify exact products, quantities, roles and required supporting components | [2 Items](../features/items-and-engineering-information/README.md) |
| Prepare representations | Confirm suitable artwork, physical dimensions, terminal definitions and links | [3 Symbols](../features/symbols-and-components/README.md) |
| Establish identity | Create or reuse managed equipment without duplicate physical identities | [6 Assets](../features/equipment-and-asset-identity/README.md) |
| Develop the physical layout | Arrange equipment in a dimensionally grounded mounting layout and obtain engineer review | [7 Physical Panel Layouts](../features/physical-panel-layouts/README.md) |
| Develop electrical detail | Reference the same equipment and author source-backed terminal connections | [8 Wiring](../features/wiring-and-terminal-systems/README.md) |
| Inspect and qualify | Review findings, missing information and relevant evidence | [10 Analysis and Assurance](../features/engineering-analysis-and-assurance/README.md) |
| Save and deliver | Confirm persistence and produce appropriate schedules, BOM and drawing outputs | [12 Lifecycle](../features/saving-and-lifecycle-controls/README.md) and [11 Outputs](../features/schedules-bom-and-outputs/README.md) |

Package structure, physical-layout review and engineering information should be established before the dependent authoring work. Existing-panel tasks may reuse reviewed information rather than recreate it.

## Current documentation boundary

The repository records guided authoring as a product direction. This initial inventory has not qualified an end-to-end conversational workflow or catalogued every supported automation operation.

Detailed documentation must distinguish an application capability from a manual engineering step and from an external assistant operating the UI. Do not label a capability AI-enabled solely because an assistant can describe it.

## Human decisions and safeguards

The engineer retains design intent, equipment-selection decisions and engineering approval. Missing product ratings, terminal mappings or source evidence remain explicit unresolved conditions.

Assisted drawing operations should remain bounded and observable, preserve asset identities and revisions, and distinguish saved results from local draft changes. A symbol's appearance, a software status or a passing test is not a substitute for engineering review.

## Review next

Define the first complete design scenario to document. Identify which steps are supported today, which need manual intervention, and which are planned. Link each supported step to its detailed feature entry and verification evidence.
