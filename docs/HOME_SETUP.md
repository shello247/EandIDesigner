# EI Designer Home Setup

This runbook recreates the current EI Designer development environment on a
second Windows computer. Application code is stored in GitHub; the live SQLite
database snapshot is stored separately in the private Google Drive transfer
folder because the GitHub repository is public.

## Required Software

- Git for Windows. This workstation was verified with Git `2.54.0.windows.1`.
- Node.js `24.11.1` and npm `8.19.2`, or a compatible newer npm for Node 24.
- Codex desktop.

## Clone The Current Development Branch

```powershell
git clone https://github.com/shello247/EandIDesigner.git
Set-Location EandIDesigner
git fetch origin
git switch --track origin/codex/detailed-panel-drawings
npm ci
```

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
npm run lint
npm run test
$env:DATABASE_URL='file:./dev.db'
npm run dev -- --hostname 127.0.0.1 -p 3004
```

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

   It must report `codex/detailed-panel-drawings`.
3. Ask Codex to read `README.md`, `docs/DETAILED_PANEL_RELEASE.md`,
   `src/features/drawing_canvas/README.md`, and
   `src/features/drawing_panel_wiring/README.md` before changing code.
4. Run `git status --short` before each new implementation pass.

## Moving Work Back Between Computers

- Commit and push code changes to `codex/detailed-panel-drawings` before moving
  computers.
- Create a fresh private database snapshot whenever application records changed.
- Never edit the same SQLite database independently on both computers. SQLite
  snapshots do not merge; choose one authoritative copy and replace the older
  copy while the app is stopped.
- Keep `.env.local` local to each computer.

## Troubleshooting

- **No drawings appear:** confirm `.env.local` contains
  `DATABASE_URL=file:./dev.db` and that `prisma/dev.db` is the downloaded
  snapshot rather than a newly created empty database.
- **Prisma errors:** rerun `npm ci`, then `npm run db:setup` with
  `DATABASE_URL=file:./dev.db`.
- **Port 3004 is occupied:** stop the existing Node process or choose another
  port and update the browser URL.
- **Latest code is missing:** run `git fetch origin` and
  `git switch codex/detailed-panel-drawings`, then `git pull --ff-only`.
