export type SectionDraft<T> = { saved: T; draft: T };
export const sectionIsDirty = <T>(state: SectionDraft<T>) => JSON.stringify(state.saved) !== JSON.stringify(state.draft);
export function acknowledgeSectionSave<T>(state: SectionDraft<T>, submitted: T, saved: T): SectionDraft<T> {
  return { saved, draft: JSON.stringify(state.draft) === JSON.stringify(submitted) ? saved : state.draft };
}

// Preserve the choice across refreshes, prefer new replacements, and fall back
// to the first available note after paging, filtering or archiving.
export function resolveNoteSelection(ids: readonly string[], current: string | null, preferred?: string): string | null {
  if (preferred && ids.includes(preferred)) return preferred;
  return current && ids.includes(current) ? current : ids[0] ?? null;
}

// A queue is shared by all mounted tabs. Revision tokens are read when an
// operation starts, never captured by a click queued behind another mutation.
export class ItemWorkspaceMutationQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private generation = 0;
  constructor(public revisionId: string | null) {}
  invalidate() { this.generation += 1; }
  run<T>(operation: (revisionId: string | null) => Promise<{ value: T; revisionId: string | null }>): Promise<T> {
    const generation = this.generation;
    const next = this.tail.then(async () => {
      if (generation !== this.generation) throw new Error("This Item workspace is no longer open.");
      const result = await operation(this.revisionId);
      if (generation !== this.generation) throw new Error("A response for another Item was ignored.");
      this.revisionId = result.revisionId;
      return result.value;
    });
    this.tail = next.catch(() => undefined);
    return next;
  }
}
