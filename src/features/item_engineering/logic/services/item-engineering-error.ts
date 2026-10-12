export class ItemEngineeringError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "ARCHIVED" | "REVISION_CONFLICT" | "INVALID_GUIDANCE" | "INTEGRITY" | "VALIDATION", message: string) {
    super(message); this.name = "ItemEngineeringError";
  }
}
