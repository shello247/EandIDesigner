import { StandardsWorkspace } from "@/features/standards_assurance/ui/components/standards-workspace";
import Link from "next/link";
export default function StandardsPage() { return <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm"><span>Explore the next drawing representation · General conventions, source review pending</span><Link className="font-medium text-sky-800 underline" href="/standards/schematic-demo">Open 24 VDC conversion demo →</Link></div><StandardsWorkspace /></>; }
