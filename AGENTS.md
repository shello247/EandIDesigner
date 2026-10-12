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

## Guided drawing authoring — user direction, 2026-09-11

- Product goal: engineers describe a design in conversation (typed or spoken);
  Codex develops and refines the actual drawing in EI Designer with them. This
  is the intended end-to-end product experience, not merely drawing advice.
- For these collaborative authoring sessions, use the visible application in
  the Codex right-hand browser. This supersedes the earlier external-browser
  preference for this workflow; follow an explicit request for another surface.
- Reuse the existing application tab, keep the requested drawing/sheet visible,
  and carry out bounded, observable steps. Briefly explain the next meaningful
  operation, perform it, and verify the visible result before continuing.
- Use supported browser controls and application commands. Do not silently
  author production drawings by direct database edits or hidden model rewrites.
  Preserve application validation, canonical identities, pinned versions,
  undo/history, revision checks and unsaved drafts. Verify save acknowledgments
  at agreed milestones; distinguish saved results from local draft changes.
- Use the applicable drawing-authoring skills for actual drawing work. Ask
  only for missing choices that materially affect engineering intent; do not
  invent product ratings, connections, compatibility or engineering approval.
- Treat each session as iterative product feedback: explain any UI/command gap
  or failed operation, preserve the current design, and separately scope a
  software correction when needed. Do not bypass safeguards to make a demo work.
- This direction is not blanket permission for deletion, schema changes,
  publishing, procurement or engineering sign-off. Unsupported browser/canvas
  capabilities must be stated plainly; do not imply a hidden action was visible.
- Persistent product context: `delivery/PROJECT.md` and `delivery/CURRENT.md`.

## Verification

### Device classification and record review

- Use the controlled registry in `src/shared/device-classification/`; never infer a Device Type from a tag, name, folder or first Mini BOM line. Follow `src/features/device_classification/README.md` for the repeatable audit and correction procedure.
- Preserve exact Item revisions and Symbol versions. Classification-only repairs do not change geometry, wiring, asset tags, product selections or BOM quantities. Approved/archived drawings receive findings for explicit engineering review.
- An automated structural audit is not manufacturer revalidation. Account for every census row, parse failure, inaccessible image/document and unresolved installation condition before reporting audit completion.
- Update the numbered feature catalogue, owning module documentation and audit receipts when these behaviours change. Keep current implementation, qualified rollout and planned work explicitly distinguished.

- Dependency security: `npm run audit:dependencies`
- Logic changes: `npm run test -- <relevant test files>`
- Static checks: `npm run lint`
- Production integration: `$env:DATABASE_URL='file:./dev.db'; npm run build`
- Browser workflows: `npm run test:e2e -- --reporter=line`

Choose checks in proportion to the change and report any checks that could not be run.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
