"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import {
  updateSymbolTerminalMapAction,
  verifyTerminalMapWithAiAction
} from "../../api/actions";
import type {
  SymbolMetadata,
  SymbolTerminal,
  TerminalMapVerificationResult
} from "../../data/schema";

function cloneTerminals(metadata: SymbolMetadata): SymbolTerminal[] {
  return metadata.terminals.map((terminal) => ({ ...terminal }));
}

function nextTerminalKey(terminals: SymbolTerminal[]): string {
  const existingKeys = new Set(terminals.map((terminal) => terminal.key));

  for (let index = 1; index <= terminals.length + 20; index += 1) {
    const candidate = `T${index}`;
    if (!existingKeys.has(candidate)) {
      return candidate;
    }
  }

  return `T${Date.now()}`;
}

function normalizeTerminal(terminal: SymbolTerminal): SymbolTerminal {
  const nextFunction = terminal.function?.trim() ?? "";

  return {
    key: terminal.key.trim(),
    label: terminal.label.trim(),
    function: nextFunction.length > 0 ? nextFunction : undefined,
    anchorKey: terminal.anchorKey.trim(),
    requiredForWiring: terminal.requiredForWiring
  };
}

function VerificationReport({
  report
}: {
  report: TerminalMapVerificationResult;
}) {
  const hasIssues = report.issues.length > 0;

  return (
    <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">AI terminal-map review</h3>
        <span className="rounded-full border border-teal-100 bg-white px-2 py-1 text-[11px] font-semibold capitalize text-teal-700">
          {report.confidence} confidence
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{report.summary}</p>
      <div className="mt-3 space-y-2">
        {hasIssues ? (
          report.issues.map((issue, index) => (
            <div
              key={`${issue.message}-${index}`}
              className="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700"
            >
              <div className="font-semibold text-slate-900">
                {issue.terminalKey ? `${issue.terminalKey}: ` : ""}
                {issue.message}
              </div>
              {issue.evidence ? (
                <div className="mt-1 text-slate-500">Evidence: {issue.evidence}</div>
              ) : null}
              {issue.suggestedFix ? (
                <div className="mt-1 text-slate-500">
                  Suggested fix: {issue.suggestedFix}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-teal-100 bg-white px-3 py-2 text-xs font-semibold text-teal-700">
            <CheckCircle2 aria-hidden="true" size={14} />
            No AI concerns returned. Manual engineering approval is still required.
          </div>
        )}
      </div>
      {report.reviewNotes.length > 0 ? (
        <div className="mt-3 text-[11px] leading-5 text-slate-500">
          {report.reviewNotes.join(" ")}
        </div>
      ) : null}
    </div>
  );
}

export function TerminalMapTable({
  versionId,
  metadata,
  readOnly = false
}: {
  versionId: string;
  metadata: SymbolMetadata;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftTerminals, setDraftTerminals] = useState<SymbolTerminal[]>(
    cloneTerminals(metadata)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [verificationReport, setVerificationReport] =
    useState<TerminalMapVerificationResult | null>(null);

  const openEditor = () => {
    setDraftTerminals(cloneTerminals(metadata));
    setMessage(null);
    setIsEditorOpen(true);
  };

  const updateDraftTerminal = (
    index: number,
    updates: Partial<SymbolTerminal>
  ) => {
    setDraftTerminals((current) =>
      current.map((terminal, terminalIndex) =>
        terminalIndex === index ? { ...terminal, ...updates } : terminal
      )
    );
  };

  const addTerminal = () => {
    const key = nextTerminalKey(draftTerminals);
    setDraftTerminals((current) => [
      ...current,
      {
        key,
        label: key,
        function: "",
        anchorKey: metadata.anchors[0]?.key ?? "",
        requiredForWiring: true
      }
    ]);
  };

  const removeTerminal = (index: number) => {
    setDraftTerminals((current) =>
      current.filter((_terminal, terminalIndex) => terminalIndex !== index)
    );
  };

  const saveTerminalMap = () => {
    startTransition(async () => {
      const result = await updateSymbolTerminalMapAction({
        versionId,
        terminals: draftTerminals.map(normalizeTerminal)
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage("Terminal map updated. Validation was refreshed.");
      setVerificationReport(null);
      setIsEditorOpen(false);
      router.refresh();
    });
  };

  const verifyWithAi = () => {
    startTransition(async () => {
      setMessage(null);
      const result = await verifyTerminalMapWithAiAction(versionId);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setVerificationReport(result.data);
      setMessage("AI terminal-map review complete.");
    });
  };

  return (
    <div className="tool-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Terminal Map</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="icon-button"
            onClick={verifyWithAi}
            disabled={isPending}
          >
            <Sparkles aria-hidden="true" size={14} />
            AI verify
          </button>
          {!readOnly ? (
            <button
              type="button"
              className="icon-button"
              onClick={openEditor}
              disabled={isPending}
            >
              <Pencil aria-hidden="true" size={14} />
              Edit terminal map
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
          <AlertCircle aria-hidden="true" size={14} className="text-teal-700" />
          <span>{message}</span>
        </div>
      ) : null}

      <table className="data-table">
        <thead>
          <tr>
            <th>Terminal</th>
            <th>Label</th>
            <th>Function</th>
            <th>Anchor</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          {metadata.terminals.map((terminal) => (
            <tr key={terminal.key}>
              <td className="font-bold">{terminal.key}</td>
              <td>{terminal.label}</td>
              <td>{terminal.function || "-"}</td>
              <td>{terminal.anchorKey}</td>
              <td>{terminal.requiredForWiring ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {verificationReport ? (
        <VerificationReport report={verificationReport} />
      ) : null}

      {isEditorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminal-map-editor-title"
        >
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2
                  id="terminal-map-editor-title"
                  className="text-[15px] font-semibold"
                >
                  Edit terminal map
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Update terminal rows, then save to refresh symbol validation.
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close terminal map editor"
                onClick={() => setIsEditorOpen(false)}
                disabled={isPending}
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>

            <div className="max-h-[58vh] overflow-auto p-5">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Terminal</th>
                    <th>Label</th>
                    <th>Function</th>
                    <th>Anchor</th>
                    <th>Required</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {draftTerminals.map((terminal, index) => (
                    <tr key={`${terminal.key}-${index}`}>
                      <td>
                        <input
                          aria-label={`Terminal key ${index + 1}`}
                          className="field-input min-w-24"
                          value={terminal.key}
                          onChange={(event) =>
                            updateDraftTerminal(index, {
                              key: event.currentTarget.value
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Label for terminal ${terminal.key}`}
                          className="field-input min-w-40"
                          value={terminal.label}
                          onChange={(event) =>
                            updateDraftTerminal(index, {
                              label: event.currentTarget.value
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Function for terminal ${terminal.key}`}
                          className="field-input min-w-56"
                          value={terminal.function ?? ""}
                          onChange={(event) =>
                            updateDraftTerminal(index, {
                              function: event.currentTarget.value
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`Anchor for terminal ${terminal.key}`}
                          className="field-input min-w-40"
                          value={terminal.anchorKey}
                          onChange={(event) =>
                            updateDraftTerminal(index, {
                              anchorKey: event.currentTarget.value
                            })
                          }
                        >
                          {metadata.anchors.map((anchor) => (
                            <option key={anchor.key} value={anchor.key}>
                              {anchor.key}
                            </option>
                          ))}
                          {metadata.anchors.length === 0 ? (
                            <option value="">No anchors</option>
                          ) : null}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Required for terminal ${terminal.key}`}
                          type="checkbox"
                          checked={terminal.requiredForWiring}
                          onChange={(event) =>
                            updateDraftTerminal(index, {
                              requiredForWiring: event.currentTarget.checked
                            })
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-button icon-button-danger"
                          aria-label={`Remove terminal ${terminal.key}`}
                          onClick={() => removeTerminal(index)}
                          disabled={isPending}
                        >
                          <Trash2 aria-hidden="true" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                type="button"
                className="icon-button"
                onClick={addTerminal}
                disabled={isPending}
              >
                <Plus aria-hidden="true" size={14} />
                Add terminal
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="icon-button icon-button-primary"
                  onClick={saveTerminalMap}
                  disabled={isPending}
                >
                  <Save aria-hidden="true" size={14} />
                  Save terminal map
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
