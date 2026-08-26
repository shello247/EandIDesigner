"use client";

import { ChevronDown, ChevronUp, Copy, Settings2, Trash2 } from "lucide-react";
import type { StructuredTerminalStripMember } from "../../data/schema";
import type { TerminalStripMemberSymbol } from "../../logic/services/terminal-strip-validation";
import {
  countStructuredTerminalStripMemberAttributes,
  resolveStructuredTerminalStripMemberPurpose,
  retainStructuredTerminalStripMemberPurpose
} from "../../api/public";

export function TerminalStripMemberEditor({
  member,
  alternatives,
  componentMessage,
  canMoveUp,
  canMoveDown,
  onChange,
  onDuplicate,
  onRemove,
  onMove,
  onEditSpecifications
}: {
  member: StructuredTerminalStripMember;
  alternatives: TerminalStripMemberSymbol[];
  componentMessage?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (member: StructuredTerminalStripMember) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onEditSpecifications: () => void;
}) {
  const purpose = resolveStructuredTerminalStripMemberPurpose(member);
  const attributeCount = countStructuredTerminalStripMemberAttributes(member);

  return (
    <tr className="group border-t border-slate-200 align-middle transition-colors hover:bg-slate-50/80">
      <td className="whitespace-nowrap px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-600">
        <span
          className="inline-flex rounded bg-slate-100 px-1.5 py-1 font-mono leading-none"
          title="Permanent member identity used by wiring"
        >
          {member.token}
        </span>
      </td>
      <td className="px-2 py-1">
        <select
          className="field-input h-8 w-full min-w-0 py-1 !text-[10px]"
          aria-label={`${member.token} symbol`}
          value={`${member.symbolId}:${member.versionId}`}
          onChange={(event) => {
            const selected = alternatives.find(
              (candidate) =>
                `${candidate.symbolId}:${candidate.versionId}` ===
                event.currentTarget.value
            );
            const role = selected?.metadata.terminalStripCapability?.role;
            if (!selected || !role) return;
            onChange({
              ...member,
              symbolId: selected.symbolId,
              versionId: selected.versionId,
              role,
              engineeringAttributes:
                retainStructuredTerminalStripMemberPurpose(member),
              componentSelections: undefined
            });
          }}
        >
          {alternatives.map((symbol) => (
            <option
              key={`${symbol.symbolId}:${symbol.versionId}`}
              value={`${symbol.symbolId}:${symbol.versionId}`}
            >
              {symbol.displayName}
            </option>
          ))}
        </select>
        {componentMessage ? (
          <div className="mt-1 text-[10px] leading-3 text-amber-700">
            {componentMessage}
          </div>
        ) : null}
      </td>
      <td className="px-2 py-1 text-center">
        {member.role === "electrical" ? (
          <span
            className="inline-flex h-7 min-w-8 items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-1.5 text-[10px] font-bold tabular-nums text-teal-800"
            aria-label={`${member.token} order ${member.designation}`}
          >
            {member.designation}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-2 py-1">
        <button
          type="button"
          className="flex min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
          aria-label={`Edit ${member.token} specifications`}
          onClick={onEditSpecifications}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10px] leading-4 text-slate-800">
              {purpose ?? "No purpose recorded"}
            </span>
            <span className="block text-[9px] font-semibold text-slate-400">
              {attributeCount} {attributeCount === 1 ? "attribute" : "attributes"}
            </span>
          </span>
          <Settings2
            aria-hidden="true"
            size={16}
            className="shrink-0 text-teal-700"
          />
        </button>
      </td>
      <td className="px-2 py-1">
        <div className="mx-auto flex w-fit items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className="icon-button h-8 min-h-0 w-8 shrink-0 border-0 bg-transparent p-0 text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-950 disabled:opacity-30"
            aria-label={`Move ${member.token} up`}
            title="Move up"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={18} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button h-8 min-h-0 w-8 shrink-0 border-0 bg-transparent p-0 text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-950 disabled:opacity-30"
            aria-label={`Move ${member.token} down`}
            title="Move down"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={18} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
          <button
            type="button"
            className="icon-button h-8 min-h-0 w-8 shrink-0 border-0 bg-transparent p-0 text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-950 disabled:opacity-30"
            aria-label={`Duplicate ${member.token}`}
            title="Duplicate member"
            disabled={member.role === "end_bracket"}
            onClick={onDuplicate}
          >
            <Copy size={17} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button h-8 min-h-0 w-8 shrink-0 border-0 bg-transparent p-0 text-red-600 shadow-none hover:bg-red-50 hover:text-red-700"
            aria-label={`Remove ${member.token}`}
            title="Remove member"
            onClick={onRemove}
          >
            <Trash2 size={17} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}
