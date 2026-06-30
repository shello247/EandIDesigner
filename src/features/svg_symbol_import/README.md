# SVG Symbol Import

Imports approved device SVG drawings into the symbol registry. This is the only
device drawing creation path in the app.

## Figma SVG Standard

- Use one device per frame.
- Export the frame as SVG with a valid `viewBox`.
- Avoid embedded raster images, scripts, external references, and effects that
  do not survive SVG export cleanly.
- Add small circle, ellipse, or rectangle marker layers at wire connection
  points.
- Name marker layers with one of these patterns:
  - `terminal:A1`
  - `terminal_1`
  - `anchor:GND`
  - `anchor_SHIELD`

## Test

```powershell
npm run test -- svg_symbol_import
```

