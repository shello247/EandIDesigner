"use client";

import { useRouter } from "next/navigation";
import { type ClipboardEvent, useState, useTransition } from "react";
import { ImageIcon, NotebookPen, PanelLeftClose, PanelLeftOpen, Save, X } from "lucide-react";
import { createEngineerNoteAction } from "../../api/actions";
import type { SymbolEngineerNoteSummary } from "../../types";

type PastedImage = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

const MAX_NOTE_IMAGE_BYTES = 10 * 1024 * 1024;

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function imageFromPaste(
  event: ClipboardEvent<HTMLTextAreaElement>
): Promise<PastedImage | null> {
  const files = Array.from(event.clipboardData.files);
  const file =
    files.find((candidate) => candidate.type.startsWith("image/")) ?? null;

  if (!file) {
    return null;
  }

  if (file.size > MAX_NOTE_IMAGE_BYTES) {
    throw new Error("Pasted image must be 10 MB or smaller.");
  }

  return {
    dataUrl: await readFileAsDataUrl(file),
    fileName: file.name || "pasted-image.png",
    mimeType: file.type || "image/png",
    sizeBytes: file.size
  };
}

export function EngineerNotesPanel({
  symbolId,
  versionId,
  notes
}: {
  symbolId: string;
  versionId?: string;
  notes: SymbolEngineerNoteSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [noteText, setNoteText] = useState("");
  const [pastedImage, setPastedImage] = useState<PastedImage | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isComposerCollapsed, setIsComposerCollapsed] = useState(false);

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    startTransition(async () => {
      try {
        const image = await imageFromPaste(event);
        if (image) {
          setPastedImage(image);
          setMessage("Image snippet attached.");
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Image snippet could not be read."
        );
      }
    });
  };

  const saveNote = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("symbolId", symbolId);
      if (versionId) {
        formData.set("versionId", versionId);
      }
      formData.set("notes", noteText);

      if (pastedImage) {
        formData.set("imageDataUrl", pastedImage.dataUrl);
        formData.set("imageFileName", pastedImage.fileName);
        formData.set("imageMimeType", pastedImage.mimeType);
        formData.set("imageSizeBytes", String(pastedImage.sizeBytes));
      }

      const result = await createEngineerNoteAction(formData);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setNoteText("");
      setPastedImage(null);
      setMessage("Engineer note saved.");
      router.refresh();
    });
  };

  return (
    <div
      className={[
        "grid gap-5",
        isComposerCollapsed
          ? "xl:grid-cols-[52px_minmax(0,1fr)]"
          : "xl:grid-cols-[420px_minmax(0,1fr)]"
      ].join(" ")}
    >
      {isComposerCollapsed ? (
        <aside className="tool-panel hidden overflow-hidden xl:block">
          <div className="flex min-h-[360px] flex-col items-center gap-3 px-2 py-3">
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Expand engineer note editor"
              title="Expand note editor"
              onClick={() => setIsComposerCollapsed(false)}
            >
              <PanelLeftOpen aria-hidden="true" size={15} />
            </button>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-500">
              <NotebookPen aria-hidden="true" size={15} />
            </div>
          </div>
        </aside>
      ) : (
        <section className="tool-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-bold">Engineer Notes</h2>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Collapse engineer note editor"
              title="Collapse note editor"
              onClick={() => setIsComposerCollapsed(true)}
            >
              <PanelLeftClose aria-hidden="true" size={15} />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <label className="field-label" htmlFor="engineer-note">
              Notes
            </label>
            <textarea
              id="engineer-note"
              className="field-input min-h-40 resize-y"
              value={noteText}
              onChange={(event) => setNoteText(event.currentTarget.value)}
              onPaste={handlePaste}
            />

            {pastedImage ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <ImageIcon aria-hidden="true" size={14} />
                    {pastedImage.fileName}
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove pasted image"
                    onClick={() => setPastedImage(null)}
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Pasted engineer reference"
                  className="max-h-64 w-full rounded border border-slate-200 bg-white object-contain"
                  src={pastedImage.dataUrl}
                />
              </div>
            ) : null}

            {message ? <div className="text-xs text-slate-600">{message}</div> : null}

            <button
              type="button"
              className="icon-button icon-button-primary"
              disabled={isPending || noteText.trim().length === 0}
              onClick={saveNote}
            >
              <Save aria-hidden="true" size={14} />
              Save note
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {notes.length > 0 ? (
          notes.map((note) => (
            <article key={note.id} className="tool-panel overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
                {formatDate(note.createdAt)}
              </div>
              <div className="space-y-3 p-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {note.notes}
                </p>
                {note.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={note.imageFileName ?? "Engineer note image"}
                    className={[
                      "w-full rounded border border-slate-200 bg-white object-contain",
                      isComposerCollapsed ? "max-h-[74vh]" : "max-h-[520px]"
                    ].join(" ")}
                    src={note.imageDataUrl}
                  />
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="tool-panel p-5 text-sm text-slate-600">
            No engineer notes saved.
          </div>
        )}
      </section>
    </div>
  );
}
