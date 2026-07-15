# Drawing Terminal Blocks

`drawing_terminal_blocks` owns generated modular terminal strip configuration,
module resolution, physical sizing, rendering, and QC helpers.

Terminal Block Group V1 uses an approved feed-through terminal symbol as an
internal repeatable module. The individual module is not directly placeable.
The drawing canvas stores each complete group as one physical asset and one or
more generated `terminal_block` occurrences with:

- `symbolId: "__generated_terminal_block__"`
- `versionId: "generated_terminal_block_v1"`
- `terminalBlock.kind: "modular_terminal_strip"`
- one physical asset tag such as `TB-101`
- one asset-level group definition with count, numbering, and module version
- generated terminal anchors such as `T1_TOP` and `T1_BOTTOM`

New panel-layout groups are created from **Panel Layout > Terminal Block Group**.
The wizard requires a panel-associated backplane, allocates the next package TB
tag, accepts a group name and description, and creates 2-80 terminals numbered
from 1. Physical width is `count x module pitch`; height comes from the approved
module metadata. Placement and rendering use the existing backplane millimetre
scale.

Legacy generated strips without an asset-level definition, one-terminal strips,
and non-1 starting numbers remain readable. They are not rewritten or offered as
new group configurations.

The drawing canvas remains responsible for placement lifecycle, asset identity,
panel containment, selection, connection authoring, save/load, print, and PDF.
This feature remains pure and testable so future terminal schedules and QC can
reuse the same deterministic terminal list and anchor metadata.

Focused tests:

```powershell
npx vitest run src/features/drawing_terminal_blocks/tests/drawing-terminal-blocks.test.ts src/features/drawing_terminal_blocks/tests/terminal-block-groups.test.ts
```
