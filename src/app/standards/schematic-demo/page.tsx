import Link from "next/link";
import { createPowerSupplyExample } from "@/features/schematic_preview/api/public";
import { SchematicPreview } from "@/features/schematic_preview/api/public-ui";

export default function SchematicDemoPage() {
  return <div className="mx-auto w-full max-w-[1600px] space-y-4 p-5"><Link className="text-sm text-sky-800 underline" href="/standards">← Standards &amp; Assurance</Link><SchematicPreview source={createPowerSupplyExample()} allowOutline /><p className="text-xs text-slate-600">This example demonstrates a shared circuit model. Its equipment outlines and terminal definitions are illustrative and do not replace your project drawing or manufacturer data.</p></div>;
}
