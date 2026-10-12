"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPlacementId, type PlacementSource } from "../../../logic/services/drawing-placement";

export function usePlacementSession() {
  const [session, setSession] = useState<PlacementSource | null>(null);
  const current = useRef<PlacementSource | null>(null);
  const generation = useRef(0);
  useEffect(() => () => {
    generation.current += 1;
    current.current = null;
  }, []);
  const cancel = useCallback(() => {
    generation.current += 1;
    current.current = null;
    setSession(null);
  }, []);
  const start = useCallback((source: Omit<PlacementSource, "id">) => {
    generation.current += 1;
    const next = { ...source, id: createPlacementId("placement_session") };
    current.current = next;
    setSession(next);
  }, []);
  const replace = useCallback((source: PlacementSource) => {
    current.current = source;
    setSession(source);
  }, []);
  return { session, current, generation, start, cancel, replace };
}
