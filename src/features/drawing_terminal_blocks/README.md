# Drawing Terminal Blocks

`drawing_terminal_blocks` owns generated modular terminal strip configuration,
layout, rendering, and QC helpers.

V1 terminal blocks are not approved symbol registry rows. The drawing canvas
stores them as generated `terminal_block` placements with:

- `symbolId: "__generated_terminal_block__"`
- `versionId: "generated_terminal_block_v1"`
- `terminalBlock.kind: "modular_terminal_strip"`
- one physical asset tag such as `TB-101`
- generated terminal anchors such as `T1_TOP` and `T1_BOTTOM`

The drawing canvas remains responsible for placement lifecycle, asset identity,
panel containment, selection, connection authoring, save/load, print, and PDF.
This feature remains pure and testable so future terminal schedules and QC can
reuse the same deterministic terminal list and anchor metadata.

Focused test:

```powershell
npx vitest run src/features/drawing_terminal_blocks/tests/drawing-terminal-blocks.test.ts
```
