# SVG Symbol Import

`svg_symbol_import` is the only supported path for bringing device, cable, and
other drawing symbols into EI Designer.

The app no longer supports AI/raster image-to-SVG device geometry generation.
Approved drawing geometry should be prepared in Figma, exported as SVG, imported
here, reviewed, then approved in the symbol registry.

## Current Workflow

1. Create or refine the symbol in Figma.
2. Export one clean SVG per symbol.
3. Import the SVG through `/symbols/new`.
4. Review parsed metadata, terminals, anchors, and preview.
5. For panel layout symbols, enter layout usage, physical width/height in mm,
   mounting type, panel category, and whether the symbol is resizable.
6. Save as `needs_review`.
7. Approve the symbol after manual review.
8. Use the approved symbol in the drawing canvas.

## Figma SVG Standard

- Use one symbol per frame.
- Export the frame as SVG with a valid `viewBox`.
- Use a tight viewBox around the physical component outline.
- Keep geometry clean and inspectable.
- Avoid embedded raster images unless absolutely necessary.
- Avoid scripts, external references, unsafe URLs, and effects that do not
  survive SVG export cleanly.
- Add small circle, ellipse, or rectangle marker layers at wire connection
  points.
- Name marker layers using one of these patterns:
  - `terminal:A1`
  - `terminal_1`
  - `anchor:GND`
  - `anchor_SHIELD`
- Real panel layout dimensions are entered in EI Designer during import/review;
  do not rely on SVG pixels as millimetres.

## Anchor And Terminal Notes

- Anchors are the connection points used by the drawing canvas.
- Terminals define the engineering terminal map.
- Cable symbols should expose anchors at each conductor termination point.
- Device symbols should expose anchors at each terminal intended for wiring.
- A symbol can be visually simple as long as its anchors and metadata are
  accurate.

## Security And Validation

The importer sanitizes SVG before browser preview and persistence. It rejects or
strips unsafe constructs such as scripts, event handlers, `foreignObject`,
external references, and unsafe URLs.

The imported SVG must have a root `<svg>` with a valid `viewBox`.

## Tests

```powershell
npm run test -- src/features/svg_symbol_import/tests/svg_symbol_import.test.ts
```

Full app verification:

```powershell
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'; npm run build
```
