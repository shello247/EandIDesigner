export default function BomItemsLoading() {
  return (
    <div className="space-y-5" aria-label="Loading Items Library" role="status">
      <div className="h-14 animate-pulse rounded-md bg-slate-200" />
      <div className="h-24 animate-pulse rounded-md bg-slate-200" />
      <div className="h-[420px] animate-pulse rounded-md bg-slate-200" />
    </div>
  );
}
