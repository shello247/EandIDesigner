import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import {
  listSymbolRegistryPage
} from "@/features/symbol_registry/data/queries";
import { symbolRegistryListInputSchema } from "@/features/symbol_registry/data/schema";
import { buildSymbolRegistryListUrl } from "@/features/symbol_registry/logic/services/symbol-registry-list-url";
import { SymbolTable } from "@/features/symbol_registry/ui/components/symbol-table";

export const dynamic = "force-dynamic";

export default async function SymbolsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const input = symbolRegistryListInputSchema.parse({
    deviceType: params.deviceType,
    page: params.page
  });
  const result = await listSymbolRegistryPage(input);

  if (result.page !== input.page) {
    redirect(
      buildSymbolRegistryListUrl({
        deviceType: input.deviceType,
        page: result.page
      })
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-normal">Symbol Registry</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/symbols/new" className="icon-button icon-button-primary">
            <Plus aria-hidden="true" size={18} />
            Create symbol
          </Link>
        </div>
      </div>

      <SymbolTable
        result={result}
      />
    </div>
  );
}
