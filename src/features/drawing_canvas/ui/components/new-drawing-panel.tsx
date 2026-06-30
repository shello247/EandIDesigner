"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilePlus2, Workflow } from "lucide-react";
import {
  createDrawingAction,
  createSampleDrawingAction
} from "../../api/actions";

export function NewDrawingPanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("New Wiring Drawing");
  const [drawingKey, setDrawingKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const createBlank = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("drawingKey", drawingKey);
      const result = await createDrawingAction(formData);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      router.push(`/drawings/${result.data.id}`);
      router.refresh();
    });
  };

  const createSample = () => {
    startTransition(async () => {
      const result = await createSampleDrawingAction();

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      router.push(`/drawings/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Blank Drawing</h2>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="field-label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="field-input"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="drawing-key">
              Drawing key
            </label>
            <input
              id="drawing-key"
              className="field-input"
              value={drawingKey}
              onChange={(event) => setDrawingKey(event.currentTarget.value)}
              placeholder="Optional"
            />
          </div>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={isPending}
            onClick={createBlank}
          >
            <FilePlus2 aria-hidden="true" size={15} />
            Create blank drawing
          </button>
        </div>
      </section>

      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">NMT81 to NRF81 Sample</h2>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-600">
            Creates the first proof drawing using approved NMT81, NRF81, and CLX
            Cable 1 Pair symbols.
          </p>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={isPending}
            onClick={createSample}
          >
            <Workflow aria-hidden="true" size={15} />
            Create NMT81 to NRF81 sample
          </button>
        </div>
      </section>

      {message ? (
        <div className="tool-panel p-4 text-sm text-red-700 lg:col-span-2">
          {message}
        </div>
      ) : null}
    </div>
  );
}

