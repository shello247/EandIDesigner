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
5. For network devices, select the device type and managed status, then review
   each detected port's label, anchor, media, speed, and protocol hints.
6. For panel layout symbols, enter layout usage, physical width/height in mm,
   mounting type, panel category, and whether the symbol is resizable.
7. Save as `needs_review`.
8. Approve the symbol after manual review.
9. Use the approved symbol in its compatible canvas.

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

## Network Port Marker Contract

- The canonical Figma layer name is `network_port:<PORT_KEY>`, for example
  `network_port:ETH1`.
- `port:<PORT_KEY>` is accepted as a compatibility alias, but new symbols
  should use the canonical name.
- Port keys are normalized to uppercase and may contain only letters, numbers,
  periods, underscores, and hyphens. Keys must be unique after normalization.
- Use a separate circle, ellipse, or rectangle layer for each marker. A named
  group is supported only when it contains exactly one direct marker primitive
  and no production geometry.
- Marker names may be exported through `data-name`, `aria-label`,
  `inkscape:label`, `name`, or `id`.
- A direct marker and one parent group may use `translate(...)` or
  `matrix(a b c d e f)` transforms. Other marker transforms are rejected.
- Network marker geometry is metadata-only. It is removed from the sanitized
  preview and stored `SymbolVersion.svg`; the importer draws its own anchor
  overlay at the detected coordinates.
- The uploaded source asset remains unchanged for engineering traceability.
- Network port anchors do not create electrical terminal-map rows. Electrical
  terminal and anchor markers keep their existing behavior.

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

Network device imports require a device type and explicit media for every port.
Managed status may be managed, unmanaged, or unspecified. Missing profiles,
duplicate port keys, and missing or non-network anchor references are rejected.

## Next Phase

Network-specific symbol review and approval is implemented in
`symbol_registry`. Network canvas placement and link authoring remain outside
this importer phase and are the next networking workflow increment.

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
