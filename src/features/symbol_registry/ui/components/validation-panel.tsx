import type { ValidationIssue } from "../../data/schema";

const ISSUE_STYLES: Record<ValidationIssue["severity"], string> = {
  blocking: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-slate-200 bg-slate-50 text-slate-700"
};

export function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Validation</h2>
      </div>
      <div className="space-y-2 p-4">
        {issues.length === 0 ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-800">
            No validation issues found.
          </div>
        ) : (
          issues.map((issue, index) => (
            <div
              key={`${issue.code}-${index}`}
              className={`rounded-md border p-3 text-sm ${ISSUE_STYLES[issue.severity]}`}
            >
              <div className="font-bold">
                {issue.severity.toUpperCase()} / {issue.code}
              </div>
              <div className="mt-1">{issue.message}</div>
              {issue.path ? (
                <div className="mt-1 text-xs opacity-80">{issue.path}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
