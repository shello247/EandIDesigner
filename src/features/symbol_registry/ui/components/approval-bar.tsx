"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, CheckCircle2, RefreshCw } from "lucide-react";
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
  blockingIssueCount
}: {
  symbolId: string;
  versionId: string;
  status: SymbolStatus;
  blockingIssueCount: number;
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
          {blockingIssueCount === 0
            ? "This version is eligible for manual approval."
            : `${blockingIssueCount} blocking issue(s) must be resolved before approval.`}
        </div>
        {message ? <div className="mt-1 text-xs text-slate-600">{message}</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="icon-button"
          onClick={runValidation}
          disabled={isPending}
        >
          <RefreshCw aria-hidden="true" size={15} strokeWidth={2} />
          Validate
        </button>
        <button
          type="button"
          className="icon-button icon-button-primary disabled:cursor-not-allowed disabled:opacity-50"
          onClick={approve}
          disabled={isPending || blockingIssueCount > 0 || status === "approved"}
        >
          <CheckCircle2 aria-hidden="true" size={15} strokeWidth={2} />
          Approve
        </button>
        <button
          type="button"
          className="icon-button icon-button-danger"
          onClick={archive}
          disabled={isPending}
        >
          <Archive aria-hidden="true" size={15} strokeWidth={2} />
          Archive
        </button>
      </div>
    </div>
  );
}
