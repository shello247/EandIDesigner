export class StandardsError extends Error {
  constructor(public code: string, message: string, public latestRevisionId?: string | null) { super(message); }
}

