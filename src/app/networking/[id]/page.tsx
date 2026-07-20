import { notFound } from "next/navigation";
import {
  listApprovedNetworkSymbolVersionsByIds,
  listNetworkSymbolCatalogForMapping
} from "@/features/symbol_registry/api/public";
import { getNetworkMapDetail } from "@/features/network_maps/data/queries";
import { collectReferencedNetworkSymbolVersionIds } from "@/features/network_maps/logic/services/network-library-catalog";
import { NetworkMapShell } from "@/features/network_maps/ui/components/network-map-shell";

export const dynamic = "force-dynamic";

export default async function NetworkMapDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const catalogItemsPromise = listNetworkSymbolCatalogForMapping();
  const networkMap = await getNetworkMapDetail(id);

  if (!networkMap) {
    notFound();
  }

  const [catalogItems, referencedSymbols] = await Promise.all([
    catalogItemsPromise,
    listApprovedNetworkSymbolVersionsByIds(
      collectReferencedNetworkSymbolVersionIds(networkMap.model)
    )
  ]);

  return (
    <NetworkMapShell
      networkMap={networkMap}
      catalogItems={catalogItems}
      referencedSymbols={referencedSymbols}
    />
  );
}
