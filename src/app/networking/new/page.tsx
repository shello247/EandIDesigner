import { NewNetworkMapPanel } from "@/features/network_maps/ui/components/new-network-map-panel";

export default function NewNetworkingPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-normal">New Network Map</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Start an industrial topology package.
        </p>
      </div>

      <NewNetworkMapPanel />
    </div>
  );
}
