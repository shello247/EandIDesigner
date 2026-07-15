export default function BomCreatorLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading BOM Creator">
      <div className="h-12 animate-pulse rounded-md bg-slate-200" />
      <div className="tool-panel h-24 animate-pulse bg-slate-100" />
      <div className="tool-panel h-72 animate-pulse bg-slate-100" />
    </div>
  );
}
