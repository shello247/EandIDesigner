"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FolderPlus, Plus, Save } from "lucide-react";
import type { DrawingClientSummary } from "@/features/drawing_clients/api/public";
import { ClientCreateDialog } from "@/features/drawing_clients/ui/components/client-create-dialog";
import {
  createDrawingProjectAction,
  updateDrawingProjectAction
} from "../../api/actions";
import type { DrawingProjectDetail } from "../../types";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";

export function DrawingProjectForm({
  project,
  initialClients,
  onClose,
  onSaved
}: {
  project?: DrawingProjectDetail;
  initialClients: DrawingClientSummary[];
  onClose?: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(project?.name ?? "");
  const [clients, setClients] = useState(initialClients);
  const [clientId, setClientId] = useState(project?.clientId ?? "");
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [description, setDescription] = useState(project?.description ?? "");
  const [message, setMessage] = useState<string>();
  const [clientError, setClientError] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const nameRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef<HTMLSelectElement>(null);
  const isArchived = project?.status === "archived";
  const dirty = name !== (project?.name ?? "") || clientId !== (project?.clientId ?? "") || description !== (project?.description ?? "");
  useEffect(() => {
    if (onClose && !showClientDialog) nameRef.current?.focus();
  }, [onClose, showClientDialog]);
  useEffect(() => {
    if (isPending) return;
    if (nameError) nameRef.current?.focus();
    else if (clientError) clientRef.current?.focus();
  }, [isPending, nameError, clientError]);
  const cancel = () => {
    if (!isPending && (!dirty || window.confirm("Discard unsaved changes to this entry?"))) onClose?.();
  };

  const submit = () => {
    setMessage(undefined);
    setClientError(undefined);
    setNameError(undefined);
    startTransition(async () => {
      try {
      const formData = new FormData();
      if (project) formData.set("projectId", project.id);
      formData.set("name", name);
      formData.set("clientId", clientId);
      formData.set("description", description);
      const result = project
        ? await updateDrawingProjectAction(formData)
        : await createDrawingProjectAction(formData);
      if (!result.ok) {
        setMessage(result.error);
        setClientError(result.fieldErrors?.clientId);
        setNameError(result.fieldErrors?.name);
        if (result.fieldErrors?.name) nameRef.current?.focus();
        else if (result.fieldErrors?.clientId) clientRef.current?.focus();
        return;
      }
      if (project) {
        setMessage("Project details saved.");
        onSaved?.();
        router.refresh();
      } else {
        router.push(`/projects/${result.data.id}`);
      }
      } catch {
        setMessage("Could not save the Project. Your changes are still here; please retry.");
      }
    });
  };

  const editor = (
    <section className={onClose ? "flex min-h-0 flex-1 flex-col" : "tool-panel overflow-hidden"}>
      {!onClose ? <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">
          {project ? "Project identity" : "Project details"}
        </h2>
        {isArchived ? (
          <p className="mt-1 text-xs text-amber-700">
            Restore this Project to edit its identity.
          </p>
        ) : null}
      </div> : null}
      <div className={`grid gap-4 p-4 sm:grid-cols-2 ${onClose ? "min-h-0 overflow-y-auto" : ""}`}>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="project-name">
            Project name
          </label>
          <input
            ref={nameRef}
            id="project-name"
            className="field-input"
            value={name}
            maxLength={160}
            required
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "project-name-error" : undefined}
            disabled={isArchived || isPending}
            onChange={(event) => { setName(event.currentTarget.value); setNameError(undefined); }}
          />
          {nameError ? <p id="project-name-error" role="alert" className="mt-1 text-xs text-red-700">{nameError}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <label className="field-label" htmlFor="project-client">
              Client <span className="font-normal text-slate-400">Optional</span>
            </label>
            {!isArchived ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 disabled:text-slate-400"
                disabled={isPending}
                onClick={() => setShowClientDialog(true)}
              >
                <Plus aria-hidden="true" size={14} /> Add Client
              </button>
            ) : null}
          </div>
          <select
            ref={clientRef}
            id="project-client"
            className="field-input"
            value={clientId}
            disabled={isArchived || isPending}
            aria-invalid={Boolean(clientError)}
            aria-describedby={clientError ? "project-client-error" : undefined}
            onChange={(event) => {
              setClientId(event.currentTarget.value);
              setClientError(undefined);
            }}
          >
            <option value="">No client selected</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {clientError ? (
            <p id="project-client-error" className="mt-1 text-xs text-red-700">
              {clientError}
            </p>
          ) : null}
        </div>
        {!project ? (
          <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
            A unique Project number will be generated automatically when this
            Project is created.
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="project-description">
            Description <span className="font-normal text-slate-400">Optional</span>
          </label>
          <textarea
            id="project-description"
            className={`field-input resize-y ${onClose ? "min-h-20" : "min-h-28"}`}
            value={description}
            maxLength={1000}
            disabled={isArchived || isPending}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {description.length}/1000
          </p>
        </div>
      </div>
        {!isArchived ? (
          <div className={`flex shrink-0 flex-wrap items-center gap-3 px-4 pb-4 ${onClose ? "justify-end border-t border-slate-200 pt-3" : ""}`}>
            {message ? <p className={`w-full text-sm ${message === "Project details saved." ? "text-teal-700" : "text-red-700"}`} role={message === "Project details saved." ? "status" : "alert"}>{message}</p> : null}
            {onClose ? <button type="button" className="icon-button" disabled={isPending} onClick={cancel}>Cancel</button> : null}
            <button
              type="button"
              className="icon-button icon-button-primary"
              disabled={isPending || !name.trim() || Boolean(onClose && !dirty)}
              onClick={submit}
            >
              {project ? (
                <Save aria-hidden="true" size={16} />
              ) : (
                <FolderPlus aria-hidden="true" size={16} />
              )}
              {isPending
                ? "Saving…"
                : project
                  ? "Save Project"
                  : "Create Project"}
            </button>
          </div>
        ) : null}
    </section>
  );

  const clientDialog = showClientDialog ? (
        <ClientCreateDialog
          onCancel={() => setShowClientDialog(false)}
          onCreated={(client) => {
            setClients((current) =>
              [...current.filter((candidate) => candidate.id !== client.id), client].sort(
                (left, right) => left.name.localeCompare(right.name)
              )
            );
            setClientId(client.id);
            setClientError(undefined);
            setShowClientDialog(false);
          }}
        />
      ) : null;

  // Preserve the project draft while switching to the existing Add Client dialog.
  // Do not nest its custom overlay inside the native modal's top layer.
  if (onClose) return showClientDialog ? clientDialog : (
    <EngineeringDialog title="Edit project" subtitle={project?.projectNumber}
      compact contentSized dirty={dirty} busy={isPending} onClose={onClose}>
      {editor}
    </EngineeringDialog>
  );
  return <>{editor}{clientDialog}</>;
}
