import Link from "next/link";
import { Plus } from "lucide-react";
import { listSymbols } from "@/features/symbol_registry/data/queries";
import { SymbolTable } from "@/features/symbol_registry/ui/components/symbol-table";

export const dynamic = "force-dynamic";

export default async function SymbolsPage() {
  const symbols = await listSymbols();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Symbol Registry</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Approved SVG symbols and drafts used as the controlled source for
            future engineering drawing generation.
          </p>
        </div>
        <Link href="/symbols/new" className="icon-button icon-button-primary">
          <Plus aria-hidden="true" size={18} />
          Create symbol
        </Link>
      </div>

      <SymbolTable symbols={symbols} />
    </div>
  );
}
