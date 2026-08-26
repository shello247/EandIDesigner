# AGENTS.md - EI Designer Application

## Project

- Stack: Next.js App Router, TypeScript, React, Tailwind, Prisma, SQLite, Zod, Vitest, and Playwright.
- Feature code lives under `src/features/<feature_name>/`.
- This repository is the canonical administrative worktree for the EI Engineering Workspace.
- Workspace-level instructions are in `../../../AGENTS.md`.

## Git workflow

- Keep the canonical `EI_Designer` worktree clean, on `main`, and tracking `origin/main`.
- Start every feature from current local `main` in a linked worktree under `Application Folders/Working Branches/`.
- Run implementation, verification, and the port 3000 development server from
  the active worktree so changes are available locally in real time.
- Keep feature branches local during implementation. Do not push, create a pull
  request, or publish changes unless the user explicitly requests publication.
- When publication is requested, push with same-name upstream tracking and
  merge all changes to `main` through a squash pull request; never treat a
  feature branch as an integration branch.
- Update canonical `main` only with `git pull --ff-only origin main` after a GitHub merge.
- After verifying the merge and clean status, remove the merged worktree and its local feature branch.

## Working rules

- Run `git status --short --branch` before editing and preserve unrelated user changes.
- Keep changes small and feature-scoped; follow existing feature boundaries and naming patterns.
- Never expose or commit `.env.local`, database credentials, API keys, or other secrets.
- Do not modify generated folders such as `.next/`, `playwright-report/`, or `test-results/` by hand.
- For Prisma changes, inspect `prisma/schema.prisma` and use the repository scripts rather than editing generated clients.
- Use `npm run dev:webpack` for the shared local port 3000 runtime. Use
  Turbopack only for an explicit compatibility check because it can enter a
  repeated HMR reload loop in this workspace.
- The development scripts must resolve and use the canonical main worktree
  database. Never run a linked worktree with `DATABASE_URL=file:./dev.db`;
  that points at a different database and makes current application records
  appear to be missing.

## Verification

- Dependency security: `npm run audit:dependencies`
- Logic changes: `npm run test -- <relevant test files>`
- Static checks: `npm run lint`
- Production integration: `$env:DATABASE_URL='file:./dev.db'; npm run build`
- Browser workflows: `npm run test:e2e -- --reporter=line`

Choose checks in proportion to the change and report any checks that could not be run.
