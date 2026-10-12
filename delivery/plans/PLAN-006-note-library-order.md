# Engineer Notes Library ordering — Task 007 refinement

## A) Feature Capsule

1. **Feature:** `item_note_library_order`, within existing `item_engineering`. Persist an engineer-chosen Library order.
2. **Story:** Drag a saved note into position without changing its image, text or selected preview.
3. **Acceptance:** drop saves immediately; reload retains order; keyboard Up/Down/Home/End on a grip provides equivalent moves; failure preserves committed order and composer drafts; stale lists require refresh and a new deliberate move; archived history is not draggable.
4. **UI:** existing Item detail Engineer Notes tab. Small grip, insertion indicator, saving/error/status feedback. Keep 25-row pages and selected-only image bodies. Cross-page keyboard moves use lightweight ordered IDs, not attachment bodies.
5. **Logic:** `moveNoteBefore`, `reorderItemEngineerNote`, Zod command validation, Item/target ownership and active status, order-token and engineering-token conflict checks. No-op drops do not write. New notes retain newest-first behavior until manual ordering exists, then append; replacements inherit their old position.
6. **Data:** nullable `BomItemEngineerNote.libraryPosition` INTEGER. Existing rows stay null and retain their current order. This presentation field is excluded from immutable content hashes and engineering revision meaning. No new table, permission, integration or dependency.
7. **API:** `reorderItemEngineerNoteAction({itemId,noteId,beforeNoteId,expectedOrderToken,expectedLatestRevisionId})`; page query additionally returns active ordered IDs and a hash token. Atomic transaction validates current state before updating positions only. Existing action-result codes apply.
8. **Tests:** guidance data tests for persistence, conflicts, membership, replacement, append, archive and exact historical bytes; storage upgrade tests for nullable additive field and idempotence. Browser drag/reload, keyboard moves, selected preview/draft retention and failure/conflict recovery.
9. **Done:** focused tests, lint, standalone typecheck, guarded production build and synthetic browser checks. Backed-up additive canonical upgrade then original port 3000 read-only review. No reordering of real user records during verification.

## B) Scaffold plan

Reuse existing feature boundaries; no new module or empty folders.

- `src/features/item_engineering/logic/services/item-note-order.ts` — pure move operation.
- `src/features/item_engineering/data/schema.ts`, `guidance.ts`, `storage.ts` — validated command, persistence, list ordering and additive bootstrap.
- `src/features/item_engineering/api/actions.ts`, `api/server.ts`, `api/public.ts` — small public interfaces.
- `src/features/item_engineering/ui/components/item-engineer-notes-panel.tsx` — drag/keyboard ordering and feedback.
- `src/features/item_engineering/tests/item-guidance.test.ts` — domain/data coverage.
- `prisma/schema.prisma`, `scripts/upgrade-item-engineering-storage.ts`, `scripts/tests/item-engineering-storage.test.ts` — guarded storage upgrade.
- `tests/e2e/item-engineering.spec.ts` — browser acceptance.
- `delivery/reports/PLAN-006-TASK-007-note-order-2026-09-08.md` — actual results and recovery.

## C) Implementation chunks

1. Storage/contracts: additive nullable position, guarded backup/upgrade, pure move and Zod command. Verify fresh/existing storage and invalid moves.
2. Persistence: stable queries, conflict token, atomic row positioning, append/replacement behavior. Verify current and historical content unchanged.
3. UI: grip drag/drop with before/after indicator, keyboard alternatives and queued save/retry. Verify selection, focus, drafts and pagination.
4. Integration: synthetic tests/build, backed-up canonical upgrade, runtime restoration and read-only review. Record evidence and checkpoint locally.
