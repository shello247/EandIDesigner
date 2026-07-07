# Drawing Sheet Templates

Drawing sheet templates store reusable sheet patterns that can be inserted into a drawing with explicit asset resolution.

The feature intentionally keeps template persistence separate from `drawing_canvas`, while consuming the canvas public template contract for drawing model types, asset catalog helpers, tag generation, and wire ID derivation.

## Verification

- `npm run test -- src/features/drawing_sheet_templates/tests/drawing-sheet-template-use-cases.test.ts`
- `npm run lint`
