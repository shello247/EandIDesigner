"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Settings2, X } from "lucide-react";
import type {
  EngineeringAttributeContainer,
  EngineeringAttributeValue
} from "@/features/engineering_attributes/api/public";
import {
  EngineeringAttributesCard,
  type EngineeringAttributeChange
} from "@/features/engineering_attributes/ui/public";
import type { StructuredTerminalStripMember } from "../../data/schema";
import {
  resolveStructuredTerminalStripMemberPurpose,
  structuredTerminalStripMemberAttributeSubject
} from "../../api/public";

function displayContainerForMember(
  member: StructuredTerminalStripMember
): {
  container?: EngineeringAttributeContainer;
  synthesizedLegacyPurpose: boolean;
} {
  const values = member.engineeringAttributes?.values ?? [];
  const hasPurpose = values.some(
    (value) => value.definitionKey === "engineering_purpose"
  );
  const legacyPurpose = !hasPurpose ? member.description?.trim() : undefined;
  if (!legacyPurpose) {
    return {
      container: member.engineeringAttributes,
      synthesizedLegacyPurpose: false
    };
  }
  const purpose: EngineeringAttributeValue = {
    definitionKey: "engineering_purpose",
    definitionVersion: 1,
    kind: "text",
    value: legacyPurpose,
    source: { kind: "engineer_entered" }
  };
  return {
    container: { version: 1, values: [purpose, ...values] },
    synthesizedLegacyPurpose: true
  };
}

export function TerminalStripMemberSpecificationsDialog({
  member,
  symbolName,
  onChange,
  onClose
}: {
  member: StructuredTerminalStripMember;
  symbolName: string;
  onChange: (member: StructuredTerminalStripMember) => void;
  onClose: () => void;
}) {
  const display = useMemo(() => displayContainerForMember(member), [member]);
  const purpose = resolveStructuredTerminalStripMemberPurpose(member);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[data-engineering-attribute-editor="true"]')) {
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleAttributeChange = (
    container: EngineeringAttributeContainer | undefined,
    change: EngineeringAttributeChange
  ) => {
    let nextContainer = container;
    let nextDescription = member.description;

    if (change.definitionKey === "engineering_purpose") {
      nextDescription = undefined;
    } else if (display.synthesizedLegacyPurpose) {
      const values = (container?.values ?? []).filter(
        (value) => value.definitionKey !== "engineering_purpose"
      );
      nextContainer = values.length > 0 ? { version: 1, values } : undefined;
    }

    onChange({
      ...member,
      description: nextDescription,
      engineeringAttributes: nextContainer
    });
  };

  const dialog = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="terminal-strip-member-specifications-title"
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Settings2 aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="terminal-strip-member-specifications-title"
              className="text-sm font-bold text-slate-950"
            >
              {member.token}
              {member.designation ? ` · Terminal ${member.designation}` : ""}
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">
              {symbolName} · {purpose ?? "No purpose recorded"}
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-9 w-9 shrink-0 justify-center p-0"
            aria-label="Close member specifications"
            onClick={onClose}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <EngineeringAttributesCard
            key={`${member.id}:${member.role}`}
            assetId={member.id}
            subject={structuredTerminalStripMemberAttributeSubject(member)}
            container={display.container}
            onChange={handleAttributeChange}
            title="Member specifications"
            subtitle={`${display.container?.values.length ?? 0} recorded`}
            defaultExpanded
            editorDescription="Record a controlled engineering value for this physical terminal-strip member."
          />
        </div>

        <footer className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={onClose}
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}
