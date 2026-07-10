"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilePlus2 } from "lucide-react";
import { createNetworkMapAction } from "../../api/actions";

export function NewNetworkMapPanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("New Industrial Network Map");
  const [mapKey, setMapKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const createBlank = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("mapKey", mapKey);
      const result = await createNetworkMapAction(formData);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      router.push(`/networking/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="grid max-w-xl gap-5">
      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Network Map Package</h2>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="field-label" htmlFor="network-map-title">
              Title
            </label>
            <input
              id="network-map-title"
              className="field-input"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="network-map-key">
              Map key
            </label>
            <input
              id="network-map-key"
              className="field-input"
              value={mapKey}
              onChange={(event) => setMapKey(event.currentTarget.value)}
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
            Create network map
          </button>
        </div>
      </section>

      {message ? (
        <div className="tool-panel p-4 text-sm text-red-700">{message}</div>
      ) : null}
    </div>
  );
}
