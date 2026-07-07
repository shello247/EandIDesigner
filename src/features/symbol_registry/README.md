# Symbol Registry

`symbol_registry` owns the controlled SVG symbol library used by the drawing
canvas.

Approved symbols are the only geometry source for drawing placements. Other
features should use registry public actions/services instead of writing symbol
records directly.

## Current Responsibilities

- Store symbols and symbol versions.
- Store sanitized SVG text.
- Store metadata JSON including viewBox, terminals, anchors, and optional panel
  layout physical metadata.
- Store source asset records for imported SVGs.
- Store engineer notes and pasted/reference images for symbols.
- Store uploaded symbol documents for later review.
- Maintain draft, needs_review, approved, and archived symbol states.
- Expose approved symbols to the drawing canvas through the public registry
  interface.

## Prisma Data

The registry owns:

- `Symbol`
- `SymbolVersion`
- `SymbolValidationIssue`
- `SymbolSourceAsset`
- `SymbolEngineerNote`
- `SymbolDocument`

Symbol validation remains part of the symbol workflow. Drawing validation was
removed from the drawing canvas workflow, but symbol validation still matters
because symbols are the controlled source of geometry, terminals, and anchors.

## Routes

- `/symbols` - registry list.
- `/symbols/new` - SVG-only import workflow.
- `/symbols/[id]` - symbol detail, terminal map, engineer notes, documents,
  validation, and approval.
- `/symbols/documents/[documentId]/download` - document download.

## Drawing Canvas Relationship

The drawing canvas consumes approved symbols with latest approved versions. It
uses each symbol's metadata to:

- render placements.
- expose anchor hover data.
- support anchor-to-anchor connection authoring.
- derive readable endpoint labels.
- derive conductor and wire ID defaults.
- filter and place approved panel layout symbols at configured physical
  millimetre size.

The canvas should not bypass this module to read symbol internals directly.

## Tests

```powershell
npm run test -- src/features/symbol_registry/tests/symbol_registry.test.ts
```

Full app verification:

```powershell
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'; npm run build
```
