# EI Designer Home Setup

This runbook recreates the current EI Designer development environment on a
second Windows computer. Application code is stored in GitHub; the live SQLite
database snapshot is stored separately in the private Google Drive transfer
folder because the GitHub repository is public.

## Required Software

- Git for Windows. This workstation was verified with Git `2.54.0.windows.1`.
- Node.js `24.11.1` and npm `8.19.2`, or a compatible newer npm for Node 24.
- Codex desktop.

## Clone The Canonical Application

```powershell
git clone https://github.com/shello247/EandIDesigner.git
Set-Location EandIDesigner
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
```

Stop any running development server before `npm ci`. Installation automatically generates Prisma Client.

## Restore The Private Database

1. Download the latest `EI-Designer-development-*.db` file from the private
   Google Drive transfer folder.
2. Close any running EI Designer development server.
3. Place the downloaded file at `prisma/dev.db` inside the cloned repository.
4. Rename it to exactly `dev.db` if the downloaded name contains a timestamp.

Do not commit `prisma/dev.db`. SQLite files are intentionally ignored by Git.

Create `.env.local` in the repository root:

```dotenv
DATABASE_URL=file:./dev.db
DETAILED_PANEL_DRAWINGS_ENABLED=true
```

`OPENAI_API_KEY` is optional for normal drawing work. If AI terminal-map
verification is required, set the key manually on the home computer. Never put
an API key in Git, Google Drive, screenshots, or chat messages.

Initialize generated Prisma files and apply the idempotent local schema setup:

```powershell
$env:DATABASE_URL='file:./dev.db'
npm run db:setup
```

## Verify And Run

```powershell
npm run audit:dependencies
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'
npm run dev:webpack -- -p 3004
```

Webpack is the supported shared local runtime. Run it from the active linked
worktree so saved changes appear immediately. Keep the branch local until the
user explicitly requests publication.
The launcher always resolves the canonical `main` worktree database and fails
closed when it is unavailable. Do not set `DATABASE_URL=file:./dev.db` when
running a linked worktree because that selects the worktree's separate database.

Turbopack can be checked explicitly with `npm run dev -- -p 3004`. If it panics
or repeatedly recompiles through an HMR loop, stop it completely before
returning to webpack:

```powershell
npm run dev:webpack -- -p 3004
```

Do not redirect changing development logs into this repository; keep them in the terminal or in a location outside the application tree.

Open:

```text
http://127.0.0.1:3004/drawings
```

The restored Wanika drawing keeps its existing database ID, so its direct URL
continues to work:

```text
http://127.0.0.1:3004/drawings/cmr0uwq2m0000uo8gkaszl32o
```

## Start Codex At Home

1. Open the cloned `EandIDesigner` folder as the Codex workspace.
2. Confirm the checked-out branch:

   ```powershell
   git branch --show-current
   ```

   A canonical clone should report `main`. Create feature branches in linked worktrees as described by the workspace `AGENTS.md`.
3. Ask Codex to read `README.md`, `docs/DETAILED_PANEL_RELEASE.md`,
   `src/features/drawing_canvas/README.md`, and
   `src/features/drawing_panel_wiring/README.md` before changing code.
4. Run `git status --short` before each new implementation pass.

## Moving Work Back Between Computers

- Commit local checkpoints as needed. Push the active feature branch only when
  the user explicitly requests publication or transfer to another computer.
- Create a fresh private database snapshot whenever application records changed.
- Never edit the same SQLite database independently on both computers. SQLite
  snapshots do not merge; choose one authoritative copy and replace the older
  copy while the app is stopped.
- Keep `.env.local` local to each computer.

## Troubleshooting

- **No drawings appear:** confirm `.env.local` contains
  `DATABASE_URL=file:./dev.db` and that `prisma/dev.db` is the downloaded
  snapshot rather than a newly created empty database.
- **Prisma errors:** stop the development server, then run `npx prisma generate`.
  The next `npm run dev:webpack` also regenerates Prisma Client automatically
  without migrating, seeding, or otherwise modifying the database.
- **Turbopack panic or continuous compiling:** stop the Turbopack process
  completely, then run `npm run dev:webpack -- -p 3004`.
- **Port 3004 is occupied:** stop the existing Node process or choose another
  port and update the browser URL.
- **Latest code is missing:** run `git fetch origin`, `git switch main`, then
  `git pull --ff-only origin main`.
