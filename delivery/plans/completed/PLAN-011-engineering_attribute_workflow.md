# PLAN-011 — Engineering Attribute Workflow



Status: complete

Feature: engineering_attribute_workflow

Started: 2026-09-18 06:50

Completed: 2026-09-18 09:57

Duration: 188m

Timezone: America/Port_of_Spain. No monthly aggregation.



## Approved capsule

Implement the user's complete Engineering Attribute System programme. Specifications become quick to enter and reusable across Items, selected physical products, drawing interrogation, I/O schedules, BOMs and focused checks. Classification suggests fields rather than restricting legitimate data. Use compact inline tables with atomic Save changes. Unknown information stays explicit; engineer assumptions and incomplete evidence never produce verified approval.



## Contracts and interfaces

- Preserve v1/v2 profiles and immutable revision hashes. Introduce profile v3 with stable entry IDs, device/supply/channel/terminal scopes, named modes, independent condition text, unresolved entries, structured retained evidence, terminal definitions and channel memberships. Legacy groups retain names and are not automatically modes.

- Share typed units and normalization, preserving entered units. Add absolute/delta temperature, time, resistance, torque, mass, ratio, small current/voltage/frequency, imperial length and explicit nonlinear AWG conversion. Custom types only calculate when a server-controlled analysis identity exists.

- Public listAttributeTypesAction, previewItemAttributeBatchAction, saveItemAttributeBatchAction, loadAttributeEvidenceAction, normalizeEngineeringValue and resolveEffectiveEngineeringFacts. Server resolves authoritative snapshots, evidence ownership and expected revision. Failed batches write nothing. Drafts survive failed/stale saves and acknowledgments of older edits.

- Inherit one exact Item revision per physical identity, including nested components and strip members. Qualified Symbol mappings preserve existing terminal keys/anchors. Keep manufacturer facts read-only; store project settings, mode choices and assumptions separately. No first-Mini-BOM-line inference. Compare before updating historical selections.

- Drawing v3 with legacy readers. Both BOM paths share selected-product expansion, counting primary and additional parts once per physical identity. Explicit channel memberships do not imply continuity.

- Extend Panel Analysis evidence and coverage with explicit power assignments, signal/range compatibility, terminal limits, dimension consistency and contextual missing facts. Compare W/VA separately; only DC power/current conversion with known applicable voltage. Partial evidence and assumptions remain provisional.



## Scope boundaries

Includes pending PLAN-006 product selection work, not its completed note/document retirement. No new permissions, dependencies, external service, API subscription, rack configurator, automatic remapping, PDF/AI extraction, general rules engine, protection coordination, thermal simulation or automatic approval. No changes to SVG geometry or anchors. Additional product onboarding stays separate.



## Scaffold and ownership

Extend engineering_attributes (unit catalogue, templates, applicability), item_engineering (v3 schema, batch/evidence persistence/actions, effective facts/interfaces, compact table/paste/conflict/channel UI), existing selection/configuration and BOM services, drawing contracts/commands/inspectors, and Panel Analysis rules. Persistence stays in data/, public actions in api/, pure rules in logic/, presentation in ui/. Cross-feature consumers use public boundaries. Existing document/note retention and Item revisions are reused.



## UI consistency

Use current EI Designer components, fonts, spacing and status styling. Primary table: Specification | Value | Applies to / Condition | Source. Expanded evidence/history; shared batch source with row overrides; search, add specification/template/paste/manage types. Read-only archived Items. No blank-to-zero conversion.



## Baseline and rollout

Canonical main remains clean. Local linked worktree engineering-attributes begins on main plus a separately checkpointed accepted item-engineering source overlay (50f22fc); inventory under artifacts/engineering-attributes. Independent dependencies and guarded synthetic storage. Do not use live records as test fixtures or touch live generated files. Additive storage only; new typed definitions instead of repurposed identities. Reconciliation preview never guesses ambiguous values or automatically selects old drawing products. Rehearse recovery before established backup/upgrade/local cutover; start dev:webpack against canonical storage. No publication.



## Acceptance

GRV-IMAI-8 accepts environmental/I/O facts without reclassification, retains 1.8 W external versus 4.5 W chassis mode, batches evidence, maps channel 0 to terminals 1/2/3 and channel 4 starting at 15, keeps 13/14 unused/nonconnectable and commons distinct, yields matching schedule and one module in BOM/budget. Also exercise UPS input/output/modes, breaker conditional ratings, fuse/holder/conductor constraints, nested PLC products and generic symbols selecting independent products. Blank values, unit edits, unsupported calculations, historical revisions, archived evidence, in-flight drafts and type semantic integrity are explicit regressions. Geometry/wires/print remain intact; revision reads batch and attachments load lazily.



## Risks and mitigations

Historical corruption: unchanged readers/hashes and additive adapters. Stale edits: CAS plus retained drafts. False engineering confidence: explicit coverage/modes/conflicts. Duplicate physical counts: shared identity resolver. Live disruption: isolated qualification, backup and guarded cutover. Large programme: bounded tasks and continuous receipts; no premature complete status.



## Verification

Focused tests per task; npm run lint; npm run typecheck; npm run test; npm run audit:dependencies. Isolated guarded build and Playwright Item/product/BOM/strips/nesting/analysis/save-reload/print workflows. No shared runtime build. Existing intermittent Firefox zoom failure tracked separately, never disguised as passing.



## Work packages

- [x] PLAN-011-TASK-001 — Preserve accepted live source and isolated verification. Verify: Baseline inventory, independent dependencies and relevant existing tests.

- [x] PLAN-011-TASK-002 — Version 3 contracts and legacy adapters. Verify: Legacy fixtures retain values, identities and hashes; explicit unresolved entries, scopes, modes and connections validate.

- [x] PLAN-011-TASK-003 — Shared engineering normalization. Verify: Offset/delta temperature, ranges, precision, AWG and invalid unit tests.

- [x] PLAN-011-TASK-004 — Advisory applicability and reconciliation. Verify: Classification cannot block a legitimate specification; dry-run reconciliation preserves ambiguous text.

- [x] PLAN-011-TASK-005 — Standard definitions and starter templates. Verify: No invented values and no forged custom analysis semantics.

- [x] PLAN-011-TASK-006 — Structured evidence and operating modes. Verify: Ownership, retained sources, page references and conditional uniqueness.

- [x] PLAN-011-TASK-007 — Atomic batch preview and save. Verify: Transaction rollback, CAS, retry, row errors and no-op saves.

- [x] PLAN-011-TASK-008 — Compact editable specifications table. Verify: Keyboard, multi-edit save/cancel, tab drafts and responsive access.

- [x] PLAN-011-TASK-009 — Paste, templates and conflict review. Verify: Preview validation and preservation of concurrent drafts.

- [x] PLAN-011-TASK-010 — Product terminals and channels. Verify: GRV channel 0 terminals 1/2/3, channel 4 terminal 15, unused 13/14 and isolated commons.

- [x] PLAN-011-TASK-011 — Symbol product compatibility and configurations. Verify: Pinned revisions, usage, explicit terminal mapping and drift.

- [x] PLAN-011-TASK-012 — Physical product selection and drawing version 3. Verify: Save/reload, undo/redo, repeated views, strip members and nested identities.

- [x] PLAN-011-TASK-013 — Inherited specifications and source interrogation. Verify: Historical revision evidence and deliberate product updates.

- [x] PLAN-011-TASK-014 — One selected-product BOM resolver. Verify: Both generators agree and count physical products once.

- [x] PLAN-011-TASK-015 — Effective facts and explicit power assignments. Verify: Scope, mode, assumptions, conflicts and missing data.

- [x] PLAN-011-TASK-016 — Power budget and contextual coverage. Verify: Known totals, excluded alternate modes, missing coverage and capacity exceedance.

- [x] PLAN-011-TASK-017 — Signal, terminal and dimension checks. Verify: Compatible, incompatible and insufficient information scenarios.

- [x] PLAN-011-TASK-018 — I/O schedules and source navigation. Verify: Stable product/channel/terminal identity agrees with interrogation.

- [x] PLAN-011-TASK-019 — Upgrade rehearsal and reconciliation. Verify: Idempotence, history preservation, ambiguous mappings and recovery.

- [x] PLAN-011-TASK-020 — Integration qualification and local rollout. Verify: Relevant regressions, lint, types, tests, audit, isolated build/browser checks and live smoke.
