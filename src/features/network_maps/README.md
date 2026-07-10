# Network Maps

`network_maps` owns industrial networking map packages. The current milestone
keeps the scope canvas-first: map package persistence, a blank high-performance
Networking canvas, deterministic SVG rendering, and print/PDF export.

## Current Scope

- `/networking` lists network map packages.
- `/networking/new` creates a blank network map package.
- `/networking/[id]` renders the read-only map package.
- `/networking/[id]/print` returns print-ready HTML.
- `/networking/[id]/pdf` returns a PDF generated from the same SVG renderer.

Interactive placement, device authoring, link authoring, and route editing are
intentionally deferred to the next networking milestone.

## Data Model

Prisma stores packages in `NetworkMap` with a validated `modelJson` payload.
The model contains title block values, sheets, zones, network nodes, topology
links, and annotations.

Network device shapes can reuse the existing symbol registry when authoring is
introduced. Network symbols use:

- `category: "network_device"`
- network port anchors using `kind: "network_port"`
- `metadata.networkProfile` with device type and port metadata

Drawing canvas symbol reads intentionally exclude `network_device` records. The
Networking renderer can use `listNetworkSymbolsForMapping` for existing map
models that already contain network nodes, but new maps do not depend on seeded
symbols.

## Verification

```powershell
npm run test -- src/features/network_maps/tests/network_maps.test.ts src/features/symbol_registry/tests/symbol_registry.test.ts
npm run lint
$env:DATABASE_URL='file:./dev.db'; npm run build
```

## Branch Baseline

- Branch: `codex/networking`.
- Base commit: `228f822` (`Complete drawing canvas milestone`).
- Recovery source: local branch `codex/mixed-work-safety-20260710`.
- Included domains: Networking routes, `NetworkMap` persistence, the network map
  model/renderer/canvas, print/PDF export, and networking symbol-registry reads.
- Excluded domains: BOM Creator and Detailed Panel Drawing code and persistence.
- Device authoring, interactive placement, and link editing remain future
  networking phases.
- Verification: 3 focused test files / 19 tests passed, lint passed, the
  production build passed, and `tests/e2e/networking.spec.ts` passed.
