"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  FileText,
  FolderInput,
  Layers,
  Search,
  Trash2,
  X
} from "lucide-react";
import type { DrawingSectionMoveDirection } from "../../logic/commands/drawing-section-commands";
import {
  filterSheetLoaderGroups,
  type SheetLoaderGroup,
  type SheetLoaderRow
} from "../../logic/services/sheet-loader-rows";
import { MoveSheetToSectionDialog } from "./move-sheet-to-section-dialog";

function sheetRange(group: SheetLoaderGroup): string {
  return group.startSheetNumber === group.endSheetNumber
    ? `Sheet ${group.startSheetNumber}`
    : `Sheets ${group.startSheetNumber}-${group.endSheetNumber}`;
}

function groupContainsSheet(group: SheetLoaderGroup, sheetId: string): boolean {
  return (
    (group.kind === "section" && group.titlePage.sheetId === sheetId) ||
    group.rows.some((row) => row.sheetId === sheetId)
  );
}

export function SheetLoaderDialog({
  groups,
  activeSheetId,
  onCancel,
  onLoadSheet,
  onMoveSection,
  onMoveSheetToSection,
  onRequestDeleteSheet
}: {
  groups: SheetLoaderGroup[];
  activeSheetId: string;
  onCancel: () => void;
  onLoadSheet: (sheetId: string) => void;
  onMoveSection: (
    sectionId: string,
    direction: DrawingSectionMoveDirection
  ) => void;
  onMoveSheetToSection: (
    sheetId: string,
    targetSectionId: string | "front_matter"
  ) => void;
  onRequestDeleteSheet: (sheetId: string) => void;
}) {
  const titleId = "sheet-loader-dialog-title";
  const descriptionId = "sheet-loader-dialog-description";
  const activeGroupId = groups.find((group) =>
    groupContainsSheet(group, activeSheetId)
  )?.id;
  const [query, setQuery] = useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () =>
      new Set(
        groups
          .filter((group) => group.id !== activeGroupId)
          .map((group) => group.id)
      )
  );
  const [moveCandidate, setMoveCandidate] = useState<SheetLoaderRow | null>(
    null
  );
  const filteredGroups = useMemo(
    () => filterSheetLoaderGroups(groups, query),
    [groups, query]
  );
  const sectionGroups = groups.filter((group) => group.kind === "section");
  const sheetCount = groups.reduce(
    (total, group) =>
      total + group.rows.length + (group.kind === "section" ? 1 : 0),
    0
  );

  const toggleGroup = (groupId: string) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Layers aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Sheet Loader
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Load one sheet or organize complete drawing sections. Package
              preview and PDF follow this same order.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close sheet loader"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="min-h-0 overflow-auto px-5 py-4">
          <label className="mb-3 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
            <Search aria-hidden="true" size={14} className="shrink-0" />
            <span className="sr-only">Search sheets</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by section, sheet number, name, type, or description"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="w-28 min-w-28 py-2 pr-3 whitespace-nowrap">
                  Sheet
                </th>
                <th className="min-w-52 py-2 pr-3">Name</th>
                <th className="w-32 py-2 pr-3">Type</th>
                <th className="min-w-56 py-2 pr-3">Description</th>
                <th className="w-60 min-w-60 py-2 text-right whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => {
                const sectionIndex =
                  group.kind === "section"
                    ? sectionGroups.findIndex(
                        (candidate) => candidate.id === group.id
                      )
                    : -1;
                const isCollapsed =
                  !query.trim() && collapsedGroupIds.has(group.id);
                const titlePageIsActive =
                  group.kind === "section" &&
                  group.titlePage.sheetId === activeSheetId;
                const groupIsActive = groupContainsSheet(group, activeSheetId);

                return (
                  <GroupRows
                    key={group.id}
                    group={group}
                    isCollapsed={isCollapsed}
                    titlePageIsActive={titlePageIsActive}
                    groupIsActive={groupIsActive}
                    activeSheetId={activeSheetId}
                    canMoveSectionUp={sectionIndex > 0}
                    canMoveSectionDown={
                      sectionIndex >= 0 && sectionIndex < sectionGroups.length - 1
                    }
                    canMoveSheet={sectionGroups.length > 0}
                    onToggle={() => toggleGroup(group.id)}
                    onLoadSheet={onLoadSheet}
                    onMoveSection={onMoveSection}
                    onRequestMoveSheet={setMoveCandidate}
                    canDeleteSheet={sheetCount > 1}
                    onRequestDeleteSheet={onRequestDeleteSheet}
                  />
                );
              })}
              {filteredGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm font-medium text-slate-500"
                  >
                    No sheets match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {moveCandidate ? (
        <MoveSheetToSectionDialog
          sheet={moveCandidate}
          groups={groups}
          onCancel={() => setMoveCandidate(null)}
          onMove={(targetSectionId) => {
            onMoveSheetToSection(moveCandidate.sheetId, targetSectionId);
            setMoveCandidate(null);
          }}
        />
      ) : null}
    </div>
  );
}

function GroupRows({
  group,
  isCollapsed,
  titlePageIsActive,
  groupIsActive,
  activeSheetId,
  canMoveSectionUp,
  canMoveSectionDown,
  canMoveSheet,
  onToggle,
  onLoadSheet,
  onMoveSection,
  onRequestMoveSheet,
  canDeleteSheet,
  onRequestDeleteSheet
}: {
  group: SheetLoaderGroup;
  isCollapsed: boolean;
  titlePageIsActive: boolean;
  groupIsActive: boolean;
  activeSheetId: string;
  canMoveSectionUp: boolean;
  canMoveSectionDown: boolean;
  canMoveSheet: boolean;
  onToggle: () => void;
  onLoadSheet: (sheetId: string) => void;
  onMoveSection: (
    sectionId: string,
    direction: DrawingSectionMoveDirection
  ) => void;
  onRequestMoveSheet: (row: SheetLoaderRow) => void;
  canDeleteSheet: boolean;
  onRequestDeleteSheet: (sheetId: string) => void;
}) {
  return (
    <>
      <tr className="border-y border-slate-200 bg-slate-50">
        <td colSpan={5} className="px-2 py-2">
          <div className="flex min-h-9 items-center gap-2">
            <button
              type="button"
              className="icon-button h-7 w-7 shrink-0 p-0"
              onClick={onToggle}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.title}`}
            >
              {isCollapsed ? (
                <ChevronRight aria-hidden="true" size={14} />
              ) : (
                <ChevronDown aria-hidden="true" size={14} />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {group.kind === "section"
                    ? `Section ${group.sectionNumber}`
                    : "Front Matter"}
                </span>
                {group.kind === "section" ? (
                  <span className="truncate text-xs font-semibold text-slate-600">
                    {group.title}
                  </span>
                ) : null}
                {groupIsActive && !titlePageIsActive ? (
                  <span className="shrink-0 rounded border border-sky-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {sheetRange(group)}
                {group.kind === "section" && group.titlePage.description
                  ? ` / ${group.titlePage.description}`
                  : ""}
              </p>
            </div>
            {group.kind === "section" ? (
              <div className="flex shrink-0 flex-nowrap items-center gap-1 whitespace-nowrap">
                <button
                  type="button"
                  className="icon-button h-9 w-9 shrink-0 !p-0"
                  disabled={!canMoveSectionUp}
                  onClick={() => onMoveSection(group.id, "first")}
                  aria-label={`Move Section ${group.sectionNumber} first`}
                  title="Move section first"
                >
                  <ChevronsUp aria-hidden="true" size={20} strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className="icon-button h-9 w-9 shrink-0 !p-0"
                  disabled={!canMoveSectionUp}
                  onClick={() => onMoveSection(group.id, -1)}
                  aria-label={`Move Section ${group.sectionNumber} up`}
                  title="Move section up"
                >
                  <ChevronUp aria-hidden="true" size={20} strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className="icon-button h-9 w-9 shrink-0 !p-0"
                  disabled={!canMoveSectionDown}
                  onClick={() => onMoveSection(group.id, 1)}
                  aria-label={`Move Section ${group.sectionNumber} down`}
                  title="Move section down"
                >
                  <ChevronDown aria-hidden="true" size={20} strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  className="icon-button h-9 w-9 shrink-0 !p-0"
                  disabled={!canMoveSectionDown}
                  onClick={() => onMoveSection(group.id, "last")}
                  aria-label={`Move Section ${group.sectionNumber} last`}
                  title="Move section last"
                >
                  <ChevronsDown aria-hidden="true" size={20} strokeWidth={2.25} />
                </button>
                {titlePageIsActive ? (
                  <span className="inline-flex h-9 w-20 shrink-0 items-center justify-center rounded-md border border-sky-300 bg-sky-100 px-2 text-[11px] font-bold text-sky-800">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    className="icon-button h-9 w-20 shrink-0 justify-center px-2"
                    onClick={() => onLoadSheet(group.titlePage.sheetId)}
                  >
                    Load title
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </td>
      </tr>
      {!isCollapsed
        ? group.rows.map((row) => (
            <SheetRow
              key={row.sheetId}
              row={row}
              active={row.sheetId === activeSheetId}
              indented={group.kind === "section"}
              canMove={canMoveSheet}
              onLoadSheet={onLoadSheet}
              onRequestMove={onRequestMoveSheet}
              canDelete={canDeleteSheet}
              onRequestDelete={onRequestDeleteSheet}
            />
          ))
        : null}
      {!isCollapsed && group.kind === "section" && group.rows.length === 0 ? (
        <tr className="border-b border-slate-100">
          <td colSpan={5} className="py-3 pl-12 text-xs text-slate-500">
            No sheets in this section.
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SheetRow({
  row,
  active,
  indented,
  canMove,
  onLoadSheet,
  onRequestMove,
  canDelete,
  onRequestDelete
}: {
  row: SheetLoaderRow;
  active: boolean;
  indented: boolean;
  canMove: boolean;
  onLoadSheet: (sheetId: string) => void;
  onRequestMove: (row: SheetLoaderRow) => void;
  canDelete: boolean;
  onRequestDelete: (sheetId: string) => void;
}) {
  return (
    <tr
      className={[
        "border-b border-slate-100",
        active ? "bg-sky-50/65" : "hover:bg-slate-50"
      ].join(" ")}
    >
      <td
        className={`min-w-28 whitespace-nowrap py-3 pr-3 font-semibold text-slate-700 ${indented ? "pl-8" : ""}`}
      >
        Sheet {row.sheetNumber}
      </td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <FileText aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
          <span className="font-semibold text-slate-950">
            {row.name || `Sheet ${row.sheetNumber}`}
          </span>
        </div>
      </td>
      <td className="py-3 pr-3 text-slate-600">{row.typeLabel}</td>
      <td className="max-w-80 py-3 pr-3 text-slate-500">
        <span className="line-clamp-2">{row.description || "No description"}</span>
      </td>
      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            disabled={!canMove}
            onClick={() => onRequestMove(row)}
            aria-label={`Move ${row.name} to another section`}
            title="Move to section"
          >
            <FolderInput aria-hidden="true" size={14} />
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger h-8 w-8 p-0"
            disabled={!canDelete}
            onClick={() => onRequestDelete(row.sheetId)}
            aria-label={`Delete ${row.name}`}
            title="Delete sheet"
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
          {active ? (
            <span className="inline-flex h-8 w-20 items-center justify-center rounded-md border border-sky-300 bg-sky-100 px-3 text-xs font-bold text-sky-800">
              Active
            </span>
          ) : (
            <button
              type="button"
              className="icon-button h-8 w-20 justify-center"
              onClick={() => onLoadSheet(row.sheetId)}
            >
              Load
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
