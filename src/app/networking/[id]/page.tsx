import { notFound } from "next/navigation";
import { listNetworkSymbolsForMapping } from "@/features/symbol_registry/api/public";
import { getNetworkMapDetail } from "@/features/network_maps/data/queries";
import { NetworkMapShell } from "@/features/network_maps/ui/components/network-map-shell";

export const dynamic = "force-dynamic";

export default async function NetworkMapDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [networkMap, symbols] = await Promise.all([
    getNetworkMapDetail(id),
    listNetworkSymbolsForMapping()
  ]);

  if (!networkMap) {
    notFound();
  }

  return <NetworkMapShell networkMap={networkMap} symbols={symbols} />;
}
