import type { ReactNode } from "react";
export default function ItemsLayout({ children }: { children: ReactNode }) {
  return <>
    {process.env.EI_SYNTHETIC_PREVIEW === "true" && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">Test environment — synthetic data. Your original catalogue remains on port 3000.</div>}
    {children}
  </>;
}
