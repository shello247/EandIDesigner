"use client";

import { useMemo, useState } from "react";
import { Blocks, Plus, X } from "lucide-react";
import type {
  DrawingModel,
  DrawingSheetCanvasModel
} from "@/features/drawing_canvas/data/schema";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  allocateStructuredTerminalStripMember,
  applyStructuredTerminalStripMemberOrders,
  cloneStructuredTerminalStripMemberAttributes,
  composeTerminalStripGeometry,
  createDefaultStructuredTerminalStrip,
  listEligibleTerminalStripSymbols,
  renderStructuredTerminalStripSvg,
  structuredTerminalStripSchema,
  validateTerminalStripMemberSymbol,
  type StructuredTerminalStrip,
  type StructuredTerminalStripMember
} from "../../api/public";
import {
  resolveAutomaticComponentSelections,
  validateDrawingComponentSelections
} from "@/features/symbol_components/api/public";
import { allocateNextTagFromPrefix } from "@/features/drawing_canvas/logic/services/drawing-asset-identity";
import { getBackplanesForSheet } from "@/features/drawing_canvas/logic/services/drawing-backplane-layouts";
import { TerminalStripMemberEditor } from "./terminal-strip-member-editor";
import { TerminalStripMemberSpecificationsDialog } from "./terminal-strip-member-specifications-dialog";
import { AssetComponentConfigurator } from "@/features/symbol_components/ui/components/asset-component-configurator";

export type TerminalStripBuilderSubmission =
  | {
      mode: "create";
      name: string;
      description?: string;
      strip: StructuredTerminalStrip;
      backplaneId?: string;
    }
  | {
      mode: "edit";
      assetId: string;
      name: string;
      description?: string;
      strip: StructuredTerminalStrip;
    };

export type TerminalStripBuilderSubmissionResult =
  | { ok: true }
  | { ok: false; error: string };

export function TerminalStripBuilder({
  model,
  activeSheetModel,
  symbols,
  preferredBackplaneId,
  editingAssetId,
  requireBackplane = false,
  onCancel,
  onSubmit
}: {
  model: DrawingModel;
  activeSheetModel: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  preferredBackplaneId?: string;
  editingAssetId?: string;
  requireBackplane?: boolean;
  onCancel: () => void;
  onSubmit: (
    submission: TerminalStripBuilderSubmission
  ) => TerminalStripBuilderSubmissionResult;
}) {
  const eligibleSymbols = useMemo(
    () => listEligibleTerminalStripSymbols(symbols),
    [symbols]
  );
  const terminalStripSymbols = useMemo(
    () =>
      symbols.filter(
        (symbol) => validateTerminalStripMemberSymbol(symbol).ok
      ),
    [symbols]
  );
  const backplanes = useMemo(
    () =>
      getBackplanesForSheet(activeSheetModel).filter((backplane) =>
        Boolean(backplane.containerAssetId)
      ),
    [activeSheetModel]
  );
  const backplaneOptions = useMemo(() => {
    const assetById = new Map(model.assets.map((asset) => [asset.id, asset]));

    return backplanes.map((backplane) => {
      const panel = backplane.containerAssetId
        ? assetById.get(backplane.containerAssetId)
        : undefined;
      const backplaneName = backplane.tag.trim();
      const label = panel
        ? /^backplane$/i.test(backplaneName)
          ? `${panel.tag} Backplane`
          : `${panel.tag} · ${backplaneName}`
        : backplaneName || "Backplane";

      return { id: backplane.id, label };
    });
  }, [backplanes, model.assets]);
  const editingAsset = editingAssetId
    ? model.assets.find(
        (asset) => asset.id === editingAssetId && Boolean(asset.terminalStrip)
      )
    : undefined;
  const initialStrip = useMemo(() => {
    try {
      return { strip: createDefaultStructuredTerminalStrip(eligibleSymbols) };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Terminal-strip defaults are unavailable."
      };
    }
  }, [eligibleSymbols]);
  const mode: "create" | "edit" = editingAsset ? "edit" : "create";
  const [name, setName] = useState(editingAsset?.title ?? "Terminal Strip");
  const [description, setDescription] = useState(editingAsset?.description ?? "");
  const [strip, setStrip] = useState<StructuredTerminalStrip | undefined>(
    editingAsset?.terminalStrip
      ? applyStructuredTerminalStripMemberOrders(editingAsset.terminalStrip)
      : initialStrip.strip
  );
  const [backplaneId, setBackplaneId] = useState(
    backplanes.find((backplane) => backplane.id === preferredBackplaneId)?.id ??
      (backplanes.length === 1 || requireBackplane
        ? backplanes[0]?.id ?? ""
        : "")
  );
  const [error, setError] = useState<string | null>(null);
  const [componentMemberId, setComponentMemberId] = useState("");
  const [specificationMemberId, setSpecificationMemberId] = useState("");
  const proposedTag = useMemo(
    () => allocateNextTagFromPrefix({ model, prefix: "TB" }),
    [model]
  );
  const geometry = useMemo(
    () => (strip ? composeTerminalStripGeometry(strip, terminalStripSymbols) : undefined),
    [strip, terminalStripSymbols]
  );
  const previewMarkup = useMemo(
    () =>
      strip
        ? renderStructuredTerminalStripSvg(strip, terminalStripSymbols)
        : undefined,
    [strip, terminalStripSymbols]
  );
  const symbolByVersion = useMemo(
    () =>
      new Map(
        symbols.map((symbol) => [
          `${symbol.symbolId}:${symbol.versionId}`,
          symbol
        ])
      ),
    [symbols]
  );
  const configurableMembers = useMemo(
    () =>
      (strip?.members ?? []).flatMap((member) => {
        const symbol = symbolByVersion.get(
          `${member.symbolId}:${member.versionId}`
        );
        return symbol?.metadata.componentPositions?.length
          ? [{ member, symbol }]
          : [];
      }),
    [strip, symbolByVersion]
  );
  const terminalCount = useMemo(
    () =>
      (strip?.members ?? []).reduce((count, member) => {
        if (member.role !== "electrical") return count;
        return (
          count +
          (symbolByVersion.get(`${member.symbolId}:${member.versionId}`)?.metadata
            .terminals?.length ?? 0)
        );
      }, 0),
    [strip, symbolByVersion]
  );
  const configuredMember =
    configurableMembers.find(({ member }) => member.id === componentMemberId) ??
    configurableMembers[0];
  const specificationMember = strip?.members.find(
    (member) => member.id === specificationMemberId
  );
  const specificationMemberSymbol = specificationMember
    ? symbolByVersion.get(
        `${specificationMember.symbolId}:${specificationMember.versionId}`
      )
    : undefined;

  const memberComponentState = (member: StructuredTerminalStripMember) => {
    const symbol = symbolByVersion.get(`${member.symbolId}:${member.versionId}`);
    if (!symbol || !(symbol.metadata.componentPositions ?? []).length) {
      return { selections: member.componentSelections, message: undefined };
    }
    if (member.componentSelections) {
      return { selections: member.componentSelections, message: "Components configured" };
    }
    const automatic = resolveAutomaticComponentSelections({
      parent: symbol,
      symbols
    });
    const blocking = automatic.issues.find((issue) => issue.severity === "blocking");
    return {
      selections: blocking ? undefined : automatic.selections,
      message: blocking?.message ?? "Required components selected automatically"
    };
  };

  const updateMember = (
    memberId: string,
    updater: (member: StructuredTerminalStripMember) => StructuredTerminalStripMember
  ) => {
    setStrip((current) =>
      current
        ? applyStructuredTerminalStripMemberOrders({
            ...current,
            members: current.members.map((member) =>
              member.id === memberId ? updater(member) : member
            )
          })
        : current
    );
    setError(null);
  };

  const addMember = (role: "electrical" | "accessory") => {
    if (!strip) return;
    const symbol = eligibleSymbols.find(
      (candidate) => candidate.metadata.terminalStripCapability?.role === role
    );
    if (!symbol) {
      setError(`No approved ${role} terminal-strip symbol is available.`);
      return;
    }
    const allocated = allocateStructuredTerminalStripMember(strip, symbol);
    const rightBracketIndex = strip.members.findIndex(
      (member, index) =>
        member.role === "end_bracket" && index === strip.members.length - 1
    );
    const insertionIndex = rightBracketIndex >= 0 ? rightBracketIndex : strip.members.length;
    setStrip(applyStructuredTerminalStripMemberOrders({
      ...allocated.strip,
      members: [
        ...strip.members.slice(0, insertionIndex),
        allocated.member,
        ...strip.members.slice(insertionIndex)
      ]
    }));
  };

  const addEndBracket = (side: "left" | "right") => {
    if (!strip) return;
    const bracket = eligibleSymbols.find(
      (candidate) =>
        candidate.metadata.terminalStripCapability?.role === "end_bracket" &&
        candidate.metadata.terminalStripCapability.defaultForNewStrips
    ) ?? eligibleSymbols.find(
      (candidate) =>
        candidate.metadata.terminalStripCapability?.role === "end_bracket"
    );
    if (!bracket) {
      setError("No approved end-bracket symbol is available.");
      return;
    }
    const allocated = allocateStructuredTerminalStripMember(strip, bracket);
    setStrip(applyStructuredTerminalStripMemberOrders({
      ...allocated.strip,
      members:
        side === "left"
          ? [allocated.member, ...strip.members]
          : [...strip.members, allocated.member]
    }));
    setError(null);
  };

  const prepareStripForSave = (source: StructuredTerminalStrip) => {
    const orderedSource = applyStructuredTerminalStripMemberOrders(source);
    const members = orderedSource.members.map((member) => {
      const symbol = symbolByVersion.get(`${member.symbolId}:${member.versionId}`);
      if (!symbol) return member;
      const selections =
        member.componentSelections ??
        resolveAutomaticComponentSelections({ parent: symbol, symbols }).selections;
      const issues = validateDrawingComponentSelections({
        parent: symbol,
        selections,
        symbols
      });
      const blocking = issues.find((issue) => issue.severity === "blocking");
      if (blocking) {
        throw new Error(`${member.token}: ${blocking.message}`);
      }
      return { ...member, componentSelections: selections };
    });
    return structuredTerminalStripSchema.parse({ ...orderedSource, members });
  };

  const submit = () => {
    if (mode === "edit") {
      if (!editingAsset || !strip) {
        setError("Structured terminal strip was not found.");
        return;
      }
      let parsed: StructuredTerminalStrip;
      try {
        parsed = prepareStripForSave(strip);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Terminal strip is invalid."
        );
        return;
      }
      const result = onSubmit({
        mode,
        assetId: editingAsset.id,
        name: name.trim(),
        description: description.trim() || undefined,
        strip: parsed
      });
      if (!result.ok) {
        setError(result.error);
      }
      return;
    }
    if (!strip) {
      setError(initialStrip.error ?? "Terminal-strip defaults are unavailable.");
      return;
    }
    if (!name.trim()) {
      setError("Enter a terminal strip name.");
      return;
    }
    if (requireBackplane && !backplaneId) {
      setError("Choose a backplane for this terminal strip.");
      return;
    }

    let parsed: StructuredTerminalStrip;
    try {
      parsed = prepareStripForSave(strip);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Terminal strip is invalid."
      );
      return;
    }
    const result = onSubmit({
      mode,
      name: name.trim(),
      description: description.trim() || undefined,
      strip: parsed,
      backplaneId: backplaneId || undefined
    });
    if (!result.ok) {
      setError(result.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terminal-strip-builder-title"
        className="flex max-h-[92dvh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Blocks size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="terminal-strip-builder-title" className="text-sm font-semibold">
              Terminal Strip Builder
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Build one managed assembly from approved terminals, brackets, and accessories.
            </p>
          </div>
          <button className="icon-button h-8 w-8 p-0" onClick={onCancel} aria-label="Close terminal strip builder">
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          <div className="mb-4 grid grid-cols-4 gap-3">
            <div>
              <label className="field-label" htmlFor="terminal-strip-tag">Tag / ID</label>
              <input id="terminal-strip-tag" className="field-input bg-slate-50 font-semibold" value={editingAsset?.tag ?? proposedTag} readOnly />
            </div>
            <div>
              <label className="field-label" htmlFor="terminal-strip-name">Name</label>
              <input id="terminal-strip-name" className="field-input" value={name} maxLength={160} onChange={(event) => setName(event.currentTarget.value)} />
            </div>
            <div className="col-span-2">
              <label className="field-label" htmlFor="terminal-strip-description">Description</label>
              <input id="terminal-strip-description" className="field-input" value={description} maxLength={400} placeholder="Optional strip description" onChange={(event) => setDescription(event.currentTarget.value)} />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            {mode !== "edit" ? backplaneOptions.length > 1 ? <div>
              <label className="field-label" htmlFor="terminal-strip-backplane">Mounted on</label>
              <select id="terminal-strip-backplane" className="field-input" value={backplaneId} onChange={(event) => setBackplaneId(event.currentTarget.value)}>
                {!requireBackplane ? <option value="">Not mounted in a panel</option> : null}
                {backplaneOptions.map((backplane) => <option key={backplane.id} value={backplane.id}>{backplane.label}</option>)}
              </select>
            </div> : <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div className="font-bold text-slate-500">Mounted on</div>
              <div className="mt-1 font-medium text-slate-800">
                {backplaneOptions[0]?.label ?? "Not mounted in a panel"}
              </div>
            </div> : <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div className="font-bold text-slate-500">Shared assembly</div>
              <div className="mt-1">Updates every occurrence</div>
            </div>}
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div className="font-bold text-slate-500">Physical size</div>
              <div className="mt-1">{geometry ? `${geometry.widthMm} × ${geometry.heightMm} mm` : "Unavailable"}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div className="font-bold text-slate-500">Electrical terminals</div>
              <div className="mt-1">
                {terminalCount} terminals across{" "}
                {strip?.members.filter((member) => member.role === "electrical").length ?? 0}{" "}
                members
              </div>
            </div>
          </div>

          {strip ? (
            <>
              {previewMarkup ? (
                <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Composed preview
                  </div>
                  <div
                    className="flex min-h-36 items-center justify-center overflow-auto rounded border border-slate-200 bg-white p-3 [&>svg]:max-h-56 [&>svg]:max-w-full"
                    aria-label="Terminal strip composed preview"
                    dangerouslySetInnerHTML={{ __html: previewMarkup }}
                  />
                </div>
              ) : null}
              <div className="mb-3 flex flex-wrap gap-2">
                {strip.members[0]?.role !== "end_bracket" ? (
                  <button type="button" className="icon-button" onClick={() => addEndBracket("left")}><Plus size={14} /> Add left bracket</button>
                ) : null}
                <button type="button" className="icon-button" onClick={() => addMember("electrical")}><Plus size={14} /> Add electrical member</button>
                <button type="button" className="icon-button" onClick={() => addMember("accessory")}><Plus size={14} /> Add accessory</button>
                {strip.members.at(-1)?.role !== "end_bracket" ? (
                  <button type="button" className="icon-button" onClick={() => addEndBracket("right")}><Plus size={14} /> Add right bracket</button>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-[10px]">
                  <colgroup>
                    <col className="w-[9%]" />
                    <col className="w-[32%]" />
                    <col className="w-[7%]" />
                    <col className="w-[36%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 backdrop-blur-sm">
                    <tr>
                      <th
                        className="px-2.5 py-2"
                        title="Permanent member reference used to protect wiring identity"
                      >
                        Member ID
                      </th>
                      <th className="px-2 py-2">Terminal type</th>
                      <th className="px-2 py-2 text-center">No.</th>
                      <th className="px-2 py-2">Purpose / specifications</th>
                      <th className="px-2 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strip.members.map((member, index) => {
                      const state = memberComponentState(member);
                      const currentPinned = symbolByVersion.get(
                        `${member.symbolId}:${member.versionId}`
                      );
                      const alternatives = [
                        ...eligibleSymbols.filter(
                          (symbol) =>
                            symbol.metadata.terminalStripCapability?.role ===
                            member.role
                        ),
                        ...(currentPinned &&
                        currentPinned.metadata.terminalStripCapability?.role ===
                          member.role &&
                        !eligibleSymbols.some(
                          (symbol) => symbol.versionId === currentPinned.versionId
                        )
                          ? [currentPinned]
                          : [])
                      ];
                      return (
                        <TerminalStripMemberEditor
                          key={member.id}
                          member={{ ...member, componentSelections: state.selections }}
                          alternatives={alternatives}
                          componentMessage={state.message}
                          canMoveUp={
                            member.role !== "end_bracket" &&
                            index > 0 &&
                            strip.members[index - 1]?.role !== "end_bracket"
                          }
                          canMoveDown={
                            member.role !== "end_bracket" &&
                            index < strip.members.length - 1 &&
                            strip.members[index + 1]?.role !== "end_bracket"
                          }
                          onChange={(next) => updateMember(member.id, () => next)}
                          onEditSpecifications={() =>
                            setSpecificationMemberId(member.id)
                          }
                          onDuplicate={() => {
                            const sourceSymbol = symbolByVersion.get(`${member.symbolId}:${member.versionId}`);
                            if (!sourceSymbol) return;
                            const allocated = allocateStructuredTerminalStripMember(strip, sourceSymbol, {
                              engineeringAttributes:
                                cloneStructuredTerminalStripMemberAttributes(member)
                            });
                            setStrip(applyStructuredTerminalStripMemberOrders({ ...allocated.strip, members: [...strip.members.slice(0, index + 1), allocated.member, ...strip.members.slice(index + 1)] }));
                          }}
                          onRemove={() => {
                            if (specificationMemberId === member.id) {
                              setSpecificationMemberId("");
                            }
                            setStrip((current) => current ? applyStructuredTerminalStripMemberOrders({ ...current, members: current.members.filter((candidate) => candidate.id !== member.id) }) : current);
                          }}
                          onMove={(direction) => setStrip((current) => {
                            if (!current) return current;
                            const members = [...current.members];
                            const target = index + direction;
                            if (target < 0 || target >= members.length) return current;
                            [members[index], members[target]] = [members[target], members[index]];
                            return applyStructuredTerminalStripMemberOrders({ ...current, members });
                          })}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {configuredMember ? (
                <div className="mt-4 space-y-3 rounded-md border border-violet-200 bg-violet-50/20 p-3">
                  <div>
                    <label className="field-label" htmlFor="terminal-strip-component-member">
                      Configure installed components for member
                    </label>
                    <select
                      id="terminal-strip-component-member"
                      className="field-input"
                      value={configuredMember.member.id}
                      onChange={(event) =>
                        setComponentMemberId(event.currentTarget.value)
                      }
                    >
                      {configurableMembers.map(({ member, symbol }) => (
                        <option key={member.id} value={member.id}>
                          {member.token}
                          {member.designation ? ` / ${member.designation}` : ""} · {symbol.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <AssetComponentConfigurator
                    parent={configuredMember.symbol}
                    symbols={symbols}
                    value={
                      memberComponentState(configuredMember.member).selections ?? []
                    }
                    onChange={(selections) =>
                      updateMember(configuredMember.member.id, (member) => ({
                        ...member,
                        componentSelections: selections
                      }))
                    }
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {initialStrip.error && !editingAsset ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{initialStrip.error}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-4">
          {error ? (
            <div
              className="min-w-0 flex-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex shrink-0 gap-2">
            <button type="button" className="icon-button" onClick={onCancel}>Cancel</button>
            <button type="button" className="icon-button icon-button-primary" onClick={submit} disabled={!editingAsset && !strip}>
              <Blocks size={14} /> {editingAsset ? "Apply changes" : "Create terminal strip"}
            </button>
          </div>
        </div>
      </div>
      {specificationMember && specificationMemberSymbol ? (
        <TerminalStripMemberSpecificationsDialog
          member={specificationMember}
          symbolName={specificationMemberSymbol.displayName}
          onChange={(nextMember) =>
            updateMember(specificationMember.id, () => nextMember)
          }
          onClose={() => setSpecificationMemberId("")}
        />
      ) : null}
    </div>
  );
}
