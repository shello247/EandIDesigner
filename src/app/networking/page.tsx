import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { listNetworkMaps } from "@/features/network_maps/data/queries";
import { NetworkMapTable } from "@/features/network_maps/ui/components/network-map-table";

export const dynamic = "force-dynamic";

export default async function NetworkingPage() {
  const networkMaps = await listNetworkMaps();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Networking</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Network map packages with a dedicated canvas workspace.
          </p>
        </div>
        <Link href="/networking/new" className="icon-button icon-button-primary">
          <FilePlus2 aria-hidden="true" size={18} />
          New network map
        </Link>
      </div>

      <NetworkMapTable networkMaps={networkMaps} />
    </div>
  );
}
