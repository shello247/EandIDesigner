"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, CheckCircle2, RefreshCw, Save } from "lucide-react";
import {
  approveSymbolAction,
  archiveSymbolAction,
  validateSymbolAction
} from "../../api/actions";
import type { SymbolStatus } from "../../data/schema";

export function ApprovalBar({
  symbolId,
  versionId,
  status,
  blockingIssueCount,
  metadataDirty,
  metadataSaving,
  metadataMessage,
  onSaveMetadata
}: {
  symbolId: string;
  versionId: string;
  status: SymbolStatus;
  blockingIssueCount: number;
  metadataDirty: boolean;
  metadataSaving: boolean;
  metadataMessage: string | null;
  onSaveMetadata: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const runValidation = () => {
    startTransition(async () => {
      const result = await validateSymbolAction(versionId);
      setMessage(result.ok ? "Validation refreshed." : result.error);
      router.refresh();
    });
  };

  const approve = () => {
    startTransition(async () => {
      const result = await approveSymbolAction(versionId);
      setMessage(result.ok ? "Symbol approved." : result.error);
      router.refresh();
    });
  };

  const archive = () => {
    startTransition(async () => {
      const result = await archiveSymbolAction(symbolId);
      setMessage(result.ok ? "Symbol archived." : result.error);
      router.push("/symbols");
      router.refresh();
    });
  };

  return (
    <div className="tool-panel flex flex-wrap items-center justify-between gap-3 p-3">
      <div>
        <div className="text-[13px] font-semibold">Approval</div>
        <div className="text-xs text-slate-500">
          {status === "approved"
            ? "Approved metadata can be updated. SVG artwork and Figma-authored geometry remain controlled."
            : status === "archived"
              ? "This version is archived and read-only."
              : blockingIssueCount === 0
            ? "This version is eligible for manual approval."
            : `${blockingIssueCount} blocking issue(s) must be resolved before approval.`}
        </div>
        {message || metadataMessage ? (
          <div className="mt-1 text-xs text-slate-600">
            {message ?? metadataMessage}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {status !== "archived" ? (
          <button
            type="button"
            className="icon-button icon-button-primary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onSaveMetadata}
            disabled={isPending || metadataSaving || !metadataDirty}
          >
            <Save aria-hidden="true" size={15} strokeWidth={2} />
            {metadataSaving ? "Saving…" : "Save changes"}
          </button>
        ) : null}
        <button
          type="button"
          className="icon-button"
          onClick={runValidation}
          disabled={isPending || metadataSaving || metadataDirty}
        >
          <RefreshCw aria-hidden="true" size={15} strokeWidth={2} />
          Validate
        </button>
        <button
          type="button"
          className="icon-button icon-button-primary disabled:cursor-not-allowed disabled:opacity-50"
          onClick={approve}
          disabled={
            isPending ||
            metadataSaving ||
            metadataDirty ||
            blockingIssueCount > 0 ||
            status === "approved"
          }
        >
          <CheckCircle2 aria-hidden="true" size={15} strokeWidth={2} />
          Approve
        </button>
        <button
          type="button"
          className="icon-button icon-button-danger"
          onClick={archive}
          disabled={isPending || metadataSaving || metadataDirty}
        >
          <Archive aria-hidden="true" size={15} strokeWidth={2} />
          Archive
        </button>
      </div>
    </div>
  );
}
