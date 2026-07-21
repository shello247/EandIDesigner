# EI Designer

EI Designer is a local Next.js application for building controlled Electrical,
Instrumentation, and Control wiring drawings from approved SVG symbols.

The current milestone has completed the first usable Drawing Canvas workflow:
approved symbols can be placed on an A3 sheet, connected by semantic conductor
records, manually routed, annotated, edited, saved, approved, and previewed as a
single-page PDF.

## Current Application Shape

- Stack: Next.js App Router, TypeScript, Tailwind, Prisma, SQLite, Zod,
  Vitest, Playwright.
- Data source: SQLite through Prisma.
- Local env: `.env.local`.
- Documented env: `.env.example`.
- Feature layout: `src/features/<feature_name>/...`.
- Browser routes:
  - `/symbols` - controlled symbol registry.
  - `/symbols/new` - SVG-only symbol import from approved Figma-exported SVG.
  - `/symbols/[id]` - symbol detail, terminal map, engineer notes, documents.
  - `/drawings` - drawing list.
  - `/drawings/new` - drawing creation and NMT81-to-NRF81 sample creation.
  - `/drawings/[id]` - drawing canvas workspace.
  - `/drawings/[id]/pdf` - generated single-page PDF response.
  - `/drawings/[id]/print` - browser print preview page.

## Completed Core Workflows

### Symbol Registry

The symbol registry is the controlled source for reusable drawing symbols.
Symbols are stored as sanitized SVG plus metadata, terminals, and anchors. Device
geometry enters the system through SVG import only. Raster image-to-SVG device
generation was intentionally removed.

### Drawing Canvas

The drawing canvas stores a semantic `DrawingModel` in `Drawing.modelJson`.
The model contains:

- Sheet metadata and title block values.
- Symbol placements with plant tags, cable IDs, rotation, scale, and label
  positions.
- Anchor-to-anchor connections with wire IDs, conductor keys, cable placement
  references, orthogonal route geometry, and label positions.
- Note blocks with editable title/body, optional leader arrows, and positions.

The visible sheet is deterministically rendered from this model. It is not a
freeform vector editor.

## Important Drawing Canvas Decisions

- Cables are real SVG symbols. The routing engine does not create separate
  bundle geometry.
- Connections represent conductor links between symbol anchors.
- Manual orthogonal route editing is the primary route workflow.
- Drawing validation UI and public drawing validate/export/archive actions were
  removed from the canvas workflow. Engineering checking happens outside the
  application.
- `Approve` remains available as a manual state transition.
- `Preview PDF` opens the PDF route directly in the browser.
- Toast notifications are floating status messages, not page layout cards.

## Development Runbook

For reproducing the current development environment on another Windows
computer, including the private SQLite restore process, see
[`docs/HOME_SETUP.md`](docs/HOME_SETUP.md).

```powershell
npm ci
$env:DATABASE_URL='file:./dev.db'; npm run db:setup
$env:DATABASE_URL='file:./dev.db'; npm run dev
```

`npm ci` automatically generates Prisma Client. Stop every development server before running `npm ci` or `npx prisma generate` manually so Windows does not hold generated-client files open. Ordinary development startup only regenerates Prisma Client; it does not migrate, seed, bootstrap, or otherwise modify a database.

`npm run dev` uses Turbopack and binds to `127.0.0.1`. If Turbopack panics or enters a repeated compile/HMR loop, stop the process completely and use the supported webpack recovery command:

```powershell
$env:DATABASE_URL='file:./dev.db'; npm run dev:webpack
```

Keep development logs in the terminal. Do not redirect changing server logs into the repository because file-watcher updates can trigger unnecessary rebuilds.

Verification:

```powershell
npm run audit:dependencies
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'; npm run build
npm run test:e2e -- --reporter=line
```

Focused drawing-canvas verification:

```powershell
npm run test -- src/features/drawing_canvas/tests/drawing_canvas.test.ts src/features/drawing_canvas/tests/drawing-model-commands.test.ts
npm run test:e2e -- tests/e2e/drawing-canvas.spec.ts --reporter=line
```

## Restart Context For Next Codex Session

Read these files first:

- `README.md`
- `src/features/drawing_canvas/README.md`
- `src/features/drawing_canvas/data/schema.ts`
- `src/features/drawing_canvas/ui/components/drawing-canvas-shell.tsx`
- `src/features/drawing_canvas/ui/components/svg-drawing-surface.tsx`
- `src/features/drawing_canvas/logic/services/drawing-svg-renderer.ts`
- `tests/e2e/drawing-canvas.spec.ts`

Before new work, run:

```powershell
git status --short
```

There is no `delivery/` folder in this repository at this point, so Delivery OS
handoff files are not available unless that structure is bootstrapped later.

## Next Stage Candidates

The drawing sheet module is now in a good stopping state. Good next-stage
features are:

- Cable schedule and termination schedule pages generated from the drawing
  model.
- Standard drawing templates that capture specialist engineering knowledge for
  reuse.
- Additional controlled symbol imports for terminal blocks, glands, panels, and
  other standard items.
- Engineering notes/template reuse workflows outside the current sheet canvas.
