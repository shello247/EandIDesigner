"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DrawingProjectAssignableOption, DrawingProjectSummary } from "@/features/drawing_projects/api/public";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { drawingSettingsDraftSchema, type DrawingMeasurementUnit, type DrawingSettingsDraft, type DrawingModel } from "../../data/schema";
import { drawingTitleBlockFields } from "../../logic/services/drawing-title-fields";
import {
  applyProjectCopyProposal, buildProjectCopyProposal, isDrawingSettingsDirty,
  mapDrawingSettingsIssues, normalizeDrawingSettingsDraft, projectCopySourceKey,
  type DrawingSettingsField, type DrawingSettingsIssue, type DrawingSettingsTab, type ProjectCopyProposal
} from "../../logic/services/drawing-settings-draft";
import { MeasurementUnitToggle } from "./measurement-unit-toggle";

const tabs = [{ id: "general", label: "General" }, { id: "printed", label: "Printed Title Block" }] as const;

export function DrawingSettingsDialog({
  drawingTitle, drawingDescription, linkedProject, projectOptions, projectOptionsLoading,
  projectOptionsError, titleBlock, measurementUnit, onCancel, onRetryProjectOptions, onApply
}: {
  drawingTitle: string;
  drawingDescription: string;
  linkedProject: DrawingProjectSummary | null;
  projectOptions: DrawingProjectAssignableOption[] | null;
  projectOptionsLoading: boolean;
  projectOptionsError?: string;
  titleBlock: DrawingModel["titleBlock"];
  measurementUnit: DrawingMeasurementUnit;
  onCancel: () => void;
  onRetryProjectOptions: () => void;
  onApply: (settings: DrawingSettingsDraft, selectedProject: DrawingProjectSummary | null) => void;
}) {
  const [initial] = useState<DrawingSettingsDraft>(() => ({
    title: drawingTitle, description: drawingDescription, projectId: linkedProject?.id,
    titleBlock: { ...titleBlock }, measurementUnit
  }));
  const [draft, setDraft] = useState(initial);
  const [tab, setTab] = useState<DrawingSettingsTab>("general");
  const [issues, setIssues] = useState<DrawingSettingsIssue[]>([]);
  const [copyReview, setCopyReview] = useState<ProjectCopyProposal | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [focusRequest, setFocusRequest] = useState<{ field: string }>({ field: "title" });
  const formRef = useRef<HTMLFormElement>(null);
  const appliedRef = useRef(false);
  const id = useId();
  const dirty = isDrawingSettingsDirty(draft, initial);
  const selectedProject = draft.projectId
    ? projectOptions?.find(project => project.id === draft.projectId) ??
      (linkedProject?.id === draft.projectId ? linkedProject : null)
    : null;
  const canCopy = Boolean(selectedProject) && !projectOptionsLoading && !projectOptionsError;

  // Invalidate only the obsolete review, never the draft, when source props change.
  if (copyReview && (!canCopy || copyReview.sourceKey !== projectCopySourceKey(selectedProject))) {
    setCopyReview(null);
    setCopyMessage("Project details changed or are unavailable. Review them again.");
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>(`[data-settings-field="${focusRequest.field}"]`);
      if (target?.matches("input,select,textarea,button")) target.focus();
      else target?.querySelector<HTMLElement>("button")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  const change = (field: DrawingSettingsField, value: string) => {
    setDraft(current => field.startsWith("titleBlock.")
      ? { ...current, titleBlock: { ...current.titleBlock, [field.slice(11)]: value } }
      : { ...current, [field]: value });
    setIssues(current => current.filter(issue => issue.field !== field));
    if (field === "projectId") { setCopyReview(null); setCopyMessage(""); }
  };
  const switchTab = (next: DrawingSettingsTab) => {
    setTab(next);
    setCopyReview(null);
    setCopyMessage("");
  };
  const close = () => {
    if (!dirty || window.confirm("Discard unsaved changes to this entry?")) onCancel();
  };
  const apply = () => {
    if (!dirty || copyReview || appliedRef.current) return;
    const parsed = drawingSettingsDraftSchema.safeParse(normalizeDrawingSettingsDraft(draft));
    const nextIssues = parsed.success ? [] : mapDrawingSettingsIssues(parsed.error.issues);
    if (draft.projectId && !selectedProject) nextIssues.push({
      field: "projectId", tab: "general", message: "The selected Project is no longer available. Reload the Project list."
    });
    if (nextIssues.length) {
      setIssues(nextIssues);
      setTab(nextIssues[0].tab);
      setFocusRequest({ field: nextIssues[0].field });
      return;
    }
    if (!parsed.success) return;
    appliedRef.current = true;
    onApply(parsed.data, selectedProject);
  };
  const fieldProps = (field: DrawingSettingsField) => ({
    id: `${id}-${field}`, name: field, "data-settings-field": field,
    "aria-invalid": issues.some(issue => issue.field === field) || undefined,
    "aria-describedby": issues.some(issue => issue.field === field) ? `${id}-${field}-error` : undefined
  });
  const fieldError = (field: DrawingSettingsField) => {
    const issue = issues.find(entry => entry.field === field);
    return issue ? <p id={`${id}-${field}-error`} className="mt-1 text-xs text-red-700">{issue.message}</p> : null;
  };
  const beginCopy = () => {
    if (!canCopy || !selectedProject) return;
    const proposal = buildProjectCopyProposal(draft.titleBlock, selectedProject);
    setCopyMessage(proposal.changes.length ? "" : [
      "Already matches the linked project.",
      proposal.missingFields.length ? `${proposal.missingFields.join(", ")} unavailable; existing entries kept.` : ""
    ].filter(Boolean).join(" "));
    if (proposal.changes.length) { setCopyReview(proposal); setFocusRequest({ field: "cancel-copy" }); }
  };

  return (
    // Shared dialog handles Tab/Escape first; then stop background canvas shortcuts.
    <div onKeyDown={event => {
      const editable = event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable='true']");
      // Browsers can restore focus to the last text field when Ctrl+Z is pressed
      // on a tab/button. Keep editor commands inert outside editable controls.
      if (!editable && (((event.ctrlKey || event.metaKey) && ["z", "y", "v"].includes(event.key.toLowerCase())) ||
        ["Delete", "Backspace"].includes(event.key))) event.preventDefault();
      event.stopPropagation();
    }} onKeyUp={event => event.stopPropagation()}>
      <EngineeringDialog title="Drawing Settings" subtitle="Apply changes, then Save drawing." compact dirty={dirty} onClose={onCancel}>
        <form ref={formRef} noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); apply(); }}>
          <div role="tablist" aria-label="Drawing settings sections" className="flex shrink-0 gap-1 border-b border-slate-200 px-5">
            {tabs.map((entry, index) => <button key={entry.id} type="button" role="tab"
              id={`${id}-tab-${entry.id}`} aria-controls={`${id}-panel-${entry.id}`}
              aria-selected={tab === entry.id} tabIndex={tab === entry.id ? 0 : -1}
              className={`border-b-2 px-3 py-2.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${tab === entry.id ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              onClick={() => switchTab(entry.id)}
              onKeyDown={event => {
                const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
                  event.key === "ArrowRight" ? (index + 1) % tabs.length :
                    event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : null;
                if (next === null) return;
                event.preventDefault();
                switchTab(tabs[next].id);
                formRef.current?.querySelector<HTMLElement>(`[id="${id}-tab-${tabs[next].id}"]`)?.focus();
              }}>
              {entry.label}{issues.some(issue => issue.tab === entry.id) ? <span className="ml-1 text-red-700" aria-label="contains errors">!</span> : null}
            </button>)}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {issues.length ? <p role="alert" className="mb-3 text-xs font-medium text-red-700">Review the highlighted fields.</p> : null}
            <section role="tabpanel" id={`${id}-panel-general`} aria-labelledby={`${id}-tab-general`} hidden={tab !== "general"} className="space-y-3">
              <div>
                <label className="field-label" htmlFor={`${id}-title`}>Title</label>
                <input {...fieldProps("title")} className="field-input" value={draft.title} maxLength={200} onChange={event => change("title", event.target.value)} />
                {fieldError("title")}
              </div>
              <div>
                <label className="field-label" htmlFor={`${id}-projectId`}>Linked Project</label>
                <select {...fieldProps("projectId")} className="field-input" value={draft.projectId ?? ""}
                  disabled={projectOptionsLoading || Boolean(projectOptionsError)} onChange={event => change("projectId", event.target.value)}>
                  <option value="">Unassigned</option>
                  {(projectOptions ?? (linkedProject ? [linkedProject] : [])).map(project =>
                    <option key={project.id} value={project.id}>{project.projectNumber ? `${project.projectNumber} — ${project.name}` : project.name}{project.status === "archived" ? " (Archived)" : ""}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">Project membership does not change printed details.</p>
                {projectOptionsLoading ? <p className="mt-1 text-xs text-slate-500" role="status">Loading active Projects…</p> :
                  projectOptionsError ? <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-700" role="alert">
                    <span>{projectOptionsError}</span><button type="button" className="font-semibold underline" onClick={onRetryProjectOptions}>Retry</button>
                  </div> : linkedProject?.status === "archived" && draft.projectId === linkedProject.id ?
                    <p className="mt-1 text-xs text-amber-700">This drawing retains its archived Project. Choose another active Project or Unassigned to change it.</p> : null}
                {fieldError("projectId")}
              </div>
              <div>
                <label className="field-label" htmlFor={`${id}-description`}>Drawing description</label>
                <textarea {...fieldProps("description")} rows={3} className="field-input resize-y" value={draft.description ?? ""} maxLength={500}
                  placeholder="Purpose, scope, or engineering context" onChange={event => change("description", event.target.value)} />
                <p className="mt-0.5 text-right text-xs text-slate-400">{draft.description?.length ?? 0}/500</p>
                {fieldError("description")}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2" {...fieldProps("measurementUnit")}>
                <span className="field-label !mb-0">Measurement units</span>
                <MeasurementUnitToggle value={draft.measurementUnit} onChange={value => change("measurementUnit", value)} ariaLabel="Drawing settings measurement units" />
                {fieldError("measurementUnit")}
              </div>
            </section>

            <section role="tabpanel" id={`${id}-panel-printed`} aria-labelledby={`${id}-tab-printed`} hidden={tab !== "printed"}>
              {copyReview ? <div className="space-y-3">
                <div><h3 className="text-sm font-semibold">Review project details</h3><p className="mt-1 break-words text-xs text-slate-500">{selectedProject?.name} · Updates this draft only.</p></div>
                <dl className="divide-y divide-slate-200 rounded-md border border-slate-200 px-3">
                  {copyReview.changes.map(entry => <div key={entry.field} className="py-3">
                    <dt className="text-xs font-semibold">{entry.label}</dt>
                    <dd className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="min-w-0 break-words"><span className="block text-slate-500">Current</span>{entry.before || "Blank"}</div>
                      <div className="min-w-0 break-words"><span className="block text-slate-500">Proposed</span>{entry.after}</div>
                    </dd>
                  </div>)}
                </dl>
                {copyReview.missingFields.length ? <p className="text-xs text-slate-500">{copyReview.missingFields.join(", ")} unavailable; existing entries will be kept.</p> : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="icon-button" data-settings-field="cancel-copy" onClick={() => { setCopyReview(null); setFocusRequest({ field: "copy" }); }}>Cancel copy</button>
                  <button type="button" className="icon-button icon-button-primary" onClick={() => {
                    const copied = applyProjectCopyProposal(draft.titleBlock, copyReview, selectedProject);
                    if (!canCopy || !copied) return;
                    setDraft(current => ({ ...current, titleBlock: copied }));
                    setIssues(current => current.filter(issue => !copyReview.changes.some(entry => issue.field === `titleBlock.${entry.field}`)));
                    setCopyReview(null); setCopyMessage("Project details copied to this draft."); setFocusRequest({ field: "copy" });
                  }}>Use these values</button>
                </div>
              </div> : <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">Shared by the Title Sheet and printed sheets.</p>
                  <button type="button" className="icon-button" data-settings-field="copy" disabled={!canCopy} onClick={beginCopy}>Use project details</button>
                </div>
                {!draft.projectId ? <p className="mb-3 text-xs text-slate-500">Choose a linked Project in General to copy its details.</p> : null}
                {copyMessage ? <p role="status" className="mb-3 text-xs text-slate-600">{copyMessage}</p> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {drawingTitleBlockFields.map(field => {
                    const name = `titleBlock.${field.key}` as const;
                    return <div key={field.key} className="min-w-0">
                      <label className="field-label" htmlFor={`${id}-${name}`}>{field.label}</label>
                      <input {...fieldProps(name)} className="field-input" value={draft.titleBlock[field.key] ?? ""} placeholder={field.placeholder}
                        onChange={event => change(name, event.target.value)} />
                      {fieldError(name)}
                    </div>;
                  })}
                </div>
              </>}
            </section>
          </div>
          <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
            <button type="button" className="icon-button" onClick={close}>Cancel</button>
            <button type="submit" className="icon-button icon-button-primary" disabled={!dirty || Boolean(copyReview)}>Apply</button>
          </footer>
        </form>
      </EngineeringDialog>
    </div>
  );
}
