# EI Designer Main Feature Register

Maintained by **Specialist Commercial Solutions (SCS)**. Initial inventory dated 30 September 2026.

[Catalogue home](README.md)

This is the review index for every feature-area folder and its main overview file. Open the **Overview** links to read the documents; folder links are also provided for navigating the workspace.

**Common status:** All 12 areas are source-mapped initial overviews. Manual review, detailed capability documentation and current functional qualification remain pending. A listed capability is not a blanket claim of completeness or engineering approval.

## Feature areas

| Number | Feature area and scope | Folder | Main file |
| --- | --- | --- | --- |
| 1 | Projects and Clients — organisation and drawing membership | [Folder](features/projects-and-clients/) | [Overview](features/projects-and-clients/README.md) |
| 2 | Items and Engineering Information — products, attributes and evidence | [Folder](features/items-and-engineering-information/) | [Overview](features/items-and-engineering-information/README.md) |
| 3 | Symbols and Components — artwork, terminals, versions and Item links | [Folder](features/symbols-and-components/) | [Overview](features/symbols-and-components/README.md) |
| 4 | Drawing Packages — title information, sections and sheets | [Folder](features/drawing-packages/) | [Overview](features/drawing-packages/README.md) |
| 5 | Canvas Authoring — placement, interaction, annotations and history | [Folder](features/canvas-authoring/) | [Overview](features/canvas-authoring/README.md) |
| 6 | Equipment and Asset Identity — physical assets and drawing occurrences | [Folder](features/equipment-and-asset-identity/) | [Overview](features/equipment-and-asset-identity/README.md) |
| 7 | Physical Panel Layouts — mounting geometry, helpers and labels | [Folder](features/physical-panel-layouts/) | [Overview](features/physical-panel-layouts/README.md) |
| 8 | Wiring and Terminal Systems — canonical connections and terminal assemblies | [Folder](features/wiring-and-terminal-systems/) | [Overview](features/wiring-and-terminal-systems/README.md) |
| 9 | Schematic Representations — read-only alternate electrical views | [Folder](features/schematic-representations/) | [Overview](features/schematic-representations/README.md) |
| 10 | Engineering Analysis and Assurance — findings, requirements and review evidence | [Folder](features/engineering-analysis-and-assurance/) | [Overview](features/engineering-analysis-and-assurance/README.md) |
| 11 | Schedules BOM and Outputs — derived quantities, schedules and deliverables | [Folder](features/schedules-bom-and-outputs/) | [Overview](features/schedules-bom-and-outputs/README.md) |
| 12 | Saving and Lifecycle Controls — drafts, persistence, conflicts and status | [Folder](features/saving-and-lifecycle-controls/) | [Overview](features/saving-and-lifecycle-controls/README.md) |

The 12 main features are numbered **1–12**. Each overview numbers its existing sub-features using the parent's number, such as **7.6 Device labels**. There are currently **72 numbered sub-features**. Further detail uses **7.6.1**, **7.6.2** and, if needed, additional levels such as **7.6.1.1**. These deeper numbers are allocated when their entries are added; the examples do not create new entries.

Numbers identify catalogue features, not equipment tags, database keys or document section headings. Keep allocated numbers stable. The former area codes remain as reference aliases in each overview. See the [feature numbering rules](README.md#feature-numbering).

## Shared reference folders

| Reference | Folder | Main file |
| --- | --- | --- |
| Engineering concepts and design sequence | [Folder](engineering-system/) | [Engineering system overview](engineering-system/README.md) |
| Source structure and feature mapping | [Folder](architecture/) | [Architecture overview](architecture/README.md) |
| Cross-feature guided authoring | [Folder](workflows/) | [Workflow overview](workflows/README.md) |

## Review questions

- Do these areas cover the engineering work you expect to perform?
- Are any capabilities grouped under the wrong area?
- Which areas need detailed documentation first?
- Are any intended capabilities missing, and should they be marked planned rather than current?
- Are the distinctions between catalogue records, physical assets, drawing occurrences and outputs clear?

All individual overviews include their own review questions and implementation links. Detailed sub-feature files have not yet been created; this avoids presenting an unreviewed inventory as completed documentation.

## Evidence cautions identified during setup

| Topic | Caution and next review |
| --- | --- |
| Symbol lifecycle | The import README describes a separate approval step, while the registry README describes save/import availability without a separate approval workflow. Resolve the current import and registry flow before documenting user instructions. See [3 Symbols and Components](features/symbols-and-components/README.md). |
| Drawing representation selector | The schematic README still describes a button row. The inspected drawing control now provides a labelled View select. Embedded editor and standalone demonstrator need separate descriptions. See [9 Schematic Representations](features/schematic-representations/README.md). |
| Output formats | Renderer support does not prove a user-accessible export command. Audit each output's current UI and route separately. See [11 Schedules BOM and Outputs](features/schedules-bom-and-outputs/README.md). |
| Historical checks | Existing reports refer to different dates, worktrees and test ports. They remain historical evidence, not fresh verification of this inventory. |

## Review record

- Catalogue structure: Awaiting engineer review.
- Individual area descriptions: Awaiting engineer review.
- Detailed feature inventory: Not yet complete.
- Current browser qualification: Not performed in this documentation pass.
- Engineering approval: Not conferred by this catalogue.
