export type DrawingClientSummary = {
  id: string;
  name: string;
};

export type DrawingClientActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: "validation" | "not_found";
      fieldErrors?: Partial<Record<"name", string>>;
    };
