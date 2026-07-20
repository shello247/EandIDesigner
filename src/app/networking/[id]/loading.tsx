export default function NetworkMapLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-16 animate-pulse rounded-md border border-slate-200 bg-slate-100" />
      <div className="grid min-h-[640px] grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <section className="tool-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-bold">Network Library</h2>
            <p className="mt-1 text-xs text-slate-500">
              Loading approved network devices...
            </p>
          </div>
          <div className="space-y-3 p-3" data-testid="network-library-loading">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-20 animate-pulse rounded-md bg-slate-100"
              />
            ))}
          </div>
        </section>
        <div className="animate-pulse rounded-md border border-slate-200 bg-slate-100" />
        <div className="animate-pulse rounded-md border border-slate-200 bg-slate-100" />
      </div>
    </div>
  );
}
