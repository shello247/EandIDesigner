# EI Designer Application Architecture

Maintained by **Specialist Commercial Solutions (SCS)**. Initial source map, 30 September 2026; awaiting technical and engineer review.

[Catalogue home](../README.md) · [Main register](../REGISTER.md) · [Engineering system](../engineering-system/README.md)

The catalogue groups capabilities by engineering purpose. The application groups implementation under feature modules. These are related structures, not a one-to-one folder mapping.

## Application layers

The repository identifies a Next.js App Router application using React and TypeScript, with Tailwind styling, Zod contracts, Prisma and SQLite persistence, Vitest unit tests and Playwright browser tests.

| Layer | Responsibility | Starting point |
| --- | --- | --- |
| Routes and application shell | Page entry points and shared navigation | [App routes](../../../src/app/) and [sidebar](../../../src/app/app-sidebar.tsx) |
| Feature UI | Forms, workspaces and interactions | [Feature modules](../../../src/features/) |
| Feature logic | Engineering rules, commands, projections and geometry | [Drawing services](../../../src/features/drawing_canvas/logic/services/) |
| Feature data and API | Validation, queries, mutations and public boundaries | [Drawing schema](../../../src/features/drawing_canvas/data/schema.ts) and [actions](../../../src/features/drawing_canvas/api/actions.ts) |
| Shared infrastructure | Reusable controls and utilities | [Shared source](../../../src/shared/) |
| Persistence | Database model and storage relationships | [Prisma schema](../../../prisma/schema.prisma) |
| Verification | Feature unit tests and application browser workflows | [Browser tests](../../../tests/e2e/) |

The intended boundary keeps UI out of direct database access and cross-feature consumers on supported public interfaces. This document identifies the architecture to review; it does not certify that every import already conforms.

## Current module mapping

All 20 feature directories found in the inspected worktree are represented below.

| Source module | Catalogue area |
| --- | --- |
| [drawing_projects](../../../src/features/drawing_projects/) | [1 Projects and Clients](../features/projects-and-clients/README.md) |
| [drawing_clients](../../../src/features/drawing_clients/) | [1 Projects and Clients](../features/projects-and-clients/README.md) |
| [bom_creator](../../../src/features/bom_creator/) | [2 Items](../features/items-and-engineering-information/README.md), [3 Symbols](../features/symbols-and-components/README.md) and [11 Outputs](../features/schedules-bom-and-outputs/README.md) |
| [item_engineering](../../../src/features/item_engineering/) | [2 Items and Engineering Information](../features/items-and-engineering-information/README.md) |
| [engineering_attributes](../../../src/features/engineering_attributes/) | [2 Items](../features/items-and-engineering-information/README.md), [6 Assets](../features/equipment-and-asset-identity/README.md) and [8 Wiring](../features/wiring-and-terminal-systems/README.md) |
| [symbol_registry](../../../src/features/symbol_registry/) | [3 Symbols and Components](../features/symbols-and-components/README.md) |
| [svg_symbol_import](../../../src/features/svg_symbol_import/) | [3 Symbols and Components](../features/symbols-and-components/README.md) |
| [symbol_categories](../../../src/features/symbol_categories/) | [3 Symbols and Components](../features/symbols-and-components/README.md) |
| [symbol_components](../../../src/features/symbol_components/) | [3 Symbols](../features/symbols-and-components/README.md), [7 Layouts](../features/physical-panel-layouts/README.md) and [11 Outputs](../features/schedules-bom-and-outputs/README.md) |
| [drawing_canvas](../../../src/features/drawing_canvas/) | [4 Packages](../features/drawing-packages/README.md), [5 Canvas](../features/canvas-authoring/README.md), [7 Layouts](../features/physical-panel-layouts/README.md), [12 Lifecycle](../features/saving-and-lifecycle-controls/README.md), plus wiring and output integration |
| [drawing_asset_manager](../../../src/features/drawing_asset_manager/) | [6 Equipment and Asset Identity](../features/equipment-and-asset-identity/README.md) |
| [drawing_panel_asset_placement](../../../src/features/drawing_panel_asset_placement/) | [7 Layouts](../features/physical-panel-layouts/README.md) and [6 Assets](../features/equipment-and-asset-identity/README.md) |
| [drawing_terminal_blocks](../../../src/features/drawing_terminal_blocks/) | [8 Wiring](../features/wiring-and-terminal-systems/README.md) and [7 Layouts](../features/physical-panel-layouts/README.md) |
| [drawing_panel_wiring](../../../src/features/drawing_panel_wiring/) | [8 Wiring and Terminal Systems](../features/wiring-and-terminal-systems/README.md) |
| [wire_catalog](../../../src/features/wire_catalog/) | [8 Wiring and Terminal Systems](../features/wiring-and-terminal-systems/README.md) |
| [schematic_preview](../../../src/features/schematic_preview/) | [9 Schematic Representations](../features/schematic-representations/README.md) |
| [drawing_panel_analysis](../../../src/features/drawing_panel_analysis/) | [10 Engineering Analysis and Assurance](../features/engineering-analysis-and-assurance/README.md) |
| [standards_assurance](../../../src/features/standards_assurance/) | [10 Engineering Analysis and Assurance](../features/engineering-analysis-and-assurance/README.md) |
| [drawing_panel_reports](../../../src/features/drawing_panel_reports/) | [11 Outputs](../features/schedules-bom-and-outputs/README.md) and [10 Analysis](../features/engineering-analysis-and-assurance/README.md) |
| [drawing_connected_wire_schedule](../../../src/features/drawing_connected_wire_schedule/) | [11 Schedules BOM and Outputs](../features/schedules-bom-and-outputs/README.md) |

## Persistence and projection boundaries

Drawing packages use a validated JSON model with shared information and ordered sheets. Catalogue products, symbols, project organisation and assurance records have their own storage ownership. Confirm exact field ownership in the schemas before proposing changes.

Geometry rendering, canonical connectivity, analysis and reports are different responsibilities. The same physical identity may feed several projections without creating new equipment. A component's location in SVG is not an alternative database of engineering facts.

Transient canvas previews, selection and viewport state must be distinguished from committed drawing-model information. Detailed feature descriptions should document when an action touches model history or persistence.

## How to extend the mapping

For each reviewed capability, identify its UI entry point, owning service or command, validated input, persistence boundary and relevant tests. Prefer public feature interfaces when describing cross-feature use. Link to source rather than copying implementation into the catalogue.

A route or file's existence is inventory evidence only. A current behaviour claim also needs source review and, where appropriate, a synthetic-data test or a read-only runtime check.

## Verification boundaries

No build, browser test, migration or application restart was required for this documentation-only setup. Historical test instructions can depend on a particular worktree, isolated database and port. Check those guards and any shared build-directory maintenance window before running them.

## Review next

Confirm module ownership and identify gaps between intended and actual boundaries. Record those as follow-up work; this catalogue setup does not reorganise application source.
