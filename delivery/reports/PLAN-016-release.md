# PLAN-016 — Consolidated application release receipt

Date: 12 October 2026, America/Port_of_Spain.

## Scope and preservation

The Package Information implementation from PLAN-014 was missing from the running reconciled checkout. Integrated only its section/destination/loader/focus changes, preserving the current classification, product selection, component persistence, security patches, settings, toolbar and label code.

A verified pre-change local snapshot preserved 1,462 source/document files. The original item-engineering donor and other dirty worktrees were not changed. No live drawing, catalogue record or database schema was edited by this release. Only the verified port-3000 runtime was stopped after saved-draft permission.

## Changed areas

- drawing_canvas: drawing-sheet-destination, sheet-loader-rows, Add Sheet/Sheet Loader/Move Sheet dialogs, bounded shell integration and explicit surface focus.
- Unit tests: destination validation, legacy group presentation and non-mutation.
- E2E: section creation/destinations, current Device Type selectors and deliberately unoccupied routing fixtures; retained downstream identity, save, wiring and undo assertions.
- Guarded release configuration: previous drawing production regression set plus classification, toolbar, compact settings, panel labels, Item/BOM and Package Information; Chromium and Firefox, port 3121, one worker, zero automatic retries.
- Qualification config excludes verified source-backup directories from application type/lint scans, not application code.
- Feature 4 catalogue, module documentation, release runbook and public Delivery OS pointers.

## Verification checkpoint

- Focused units: 57 passed.
- Complete units: 1,303 tests in 201 files passed (196.62 seconds).
- Runner/isolation contracts: 16 passed.
- Full lint and TypeScript: passed.
- Production dependency audit: zero findings/no exceptions. Only the previously authorized Next ESLint tooling chain remains accepted through 22 October 2026 UTC.
- Guarded webpack build: passed, sourceDrift false, build ID ZKyZ9RrMsMNo_lnocfjRt.
- Build source fingerprint: 70bebca27511cab6ee5699ff888a17aa5d752f7b2fcd85156e078f09df3b4fa2.
- Initial combined browser run: 135/142 passed in 771.174 seconds, with seven failures retained. After test-only corrections, all 10 targeted Chromium/Firefox cases passed in 71.812 seconds with no retries or source drift. This covers the seven failures plus three repeated route checks; it is not described as a single clean 142-case local run.
- Firefox trace established integer CSS-pixel input at 30% fit zoom (requested x=651.8, delivered x=651). The route test now observes actual delivered pointer coordinates and retains 0.05 sheet-unit tolerance, plus a one-CSS-pixel input-delivery bound. Application routing was not changed to satisfy the test.
- Final targeted source fingerprint: 893ec6a5ca49b23314dfcdd56ea8e186cf0e9fc861f1b8827b3a73281012a43c. Only tests changed after the qualified build.
- Visually inspected synthetic desktop Package Information and narrow Add Section screenshots. Shared typography, expanded title row and accessible fixed actions are retained.

The first expanded browser gate exposed stale tests: routing attempted an already-occupied terminal pair, and two strip tests expected the retired plural category label. Correct synthetic setup/current accessible labels, never remove the application's occupancy checks or identity assertions. All failures/traces remain retained.

Earlier source has trailing blank-line-at-EOF warnings when compared with old public main. These are disclosed, not functional failures, and unrelated files are not reformatted.

## Publication controls

The GitHub repository is public. A clean release branch is based on origin/main; it does not publish the reconciled checkout's unpublished customer-report history. Explicitly selected source/config/tests/generic documentation are copied and compared. Databases, environment files, manuals, engineering images, canonical inventories and local artifacts are excluded. Pattern-based source scans found no credential signatures; this is not a universal security audit.

Publication must use a same-name upstream branch, reviewed pull request and squash merge. Canonical main is updated only by fast-forward pull. Dirty original worktrees remain recoverable. Actual PR/main identity and local live review are recorded below when confirmed.

## Live checkpoint — 12 October 2026, 16:49 AST

Restarted with `npm run dev:webpack` from the reconciled worktree, resolving canonical main SQLite. Port 3000 listener PID 21904 was verified against that checkout; test port 3121 was stopped. PID is evidence for this checkpoint, not a reusable stop command.

Read-only browser review confirmed expanded Package Information, Add Section, the existing Title Sheet and Needs section warnings for legacy working sheets. No placement, rearrangement or Save action was performed. Projects and the drawing route returned HTTP 200. Canonical database SHA-256 remained 5A0E478664D6B70E0AB5E2C663A33BBF9EA8B4AE8A5D101021E517E4596DEBAA.

Publication and GitHub CI remain pending at this checkpoint; use the PR's actual check result before merging.

## Clean-checkout CI follow-up

PR #13 at ff32cc4 passed dependency audit, lint and types on GitHub. Run 38306652489 then exposed a local-path-only Standards test guard and an unbound raw-transaction issue in the legacy Project upgrade. The test guard now uses the existing exact GitHub repository/workspace/run-identity validation. The schema/data upgrade uses a Prisma transaction-bound connection; backup, dry-run and preflight protections remain. No upgrade was executed against canonical storage.

Added four guard cases and a complete rollback regression. Focused Standards/upgrade verification passed 31 tests in 10 files locally. Original CI failures remain visible. GitHub also warns about existing v4 action runtime deprecation and the upcoming ubuntu-latest image change; no protection or required check was disabled.

The clean release checkout then passed all 1,308 unit tests in 202 files (157.81 s). GitHub run 38307341651 passed 1,307/1,308; the remaining timeout exposed the legacy required-for-wiring retirement command's EXCLUSIVE lock across pooled connections. Its CLI and synthetic fixtures now explicitly use one connection, with a regression for that configuration. Both maintenance suites passed 16 tests; timeout limits were not increased. This follows the [Prisma v6 connection-pool contract](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool). No retirement command was run on live storage.

## Verification commands and limitations

### Firefox viewport follow-up

Local requalification: isolated webpack build passed (120.165 s, build FBPh8iE61XRpbCmqSaFHw); all 24 targeted Chromium/Firefox placement, workbench, internal-wire and hit-testing checks passed without retries (115.235 s). Source fingerprint bb2d28d04b466ca1ff833029326b3cc3b0e9fc9dd302f9066259efbd3db98128 remained unchanged. Lint, standalone types and two isolation checks passed. The live server stayed up throughout this separate-build qualification.

GitHub run 38307927765 passed static checks, all 1,309 units, dependency policy, isolation contracts and webpack build; 140/142 browser checks passed. Retained Firefox traces showed the wire test's screen coordinates changing during smooth scrolling, and a placement helper cancelling a still-pending insertion without checking that it committed. Test helpers now wait for a stable SVG screen transform and assert that committed content increases before any cancellation. No routing, selection or placement behavior was weakened. The clean release checkout has its own explicitly registered synthetic database/build directory so further local qualification does not interrupt the live runtime.

Use [release runbook](../../docs/application/releases/2026-10-12.md) for exact guarded commands. Do not bootstrap the canonical catalogue. No shared runtime build while engineers have unsaved work.

Software release is not manufacturer record revalidation. Existing evidence/classification gaps and wider engineering programmes remain separate and unfinished. Historical drawings are not automatically moved into sections or reclassified.

Skills: Feature Cadence/new-feature organized the release checkpoints. SCS Industrial Web UI preserved shared compact controls and visual review. Vercel React guidance preserved existing component boundaries and event-driven state.

