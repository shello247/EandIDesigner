// Stable identities, not display numbers. null means move to the end.
export function moveNoteBefore(ids: readonly string[], noteId: string, beforeNoteId: string | null): string[] {
  if (!ids.includes(noteId) || (beforeNoteId !== null && !ids.includes(beforeNoteId))) throw new Error("Note is not in the current Library.");
  if (noteId === beforeNoteId) return [...ids];
  const next = ids.filter(id => id !== noteId);
  next.splice(beforeNoteId === null ? next.length : next.indexOf(beforeNoteId), 0, noteId);
  return next;
}
