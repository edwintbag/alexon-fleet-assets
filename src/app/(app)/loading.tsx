export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 rounded-xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-200/80" />)}
      </div>
      <div className="h-96 rounded-2xl bg-slate-200/70" />
    </div>
  );
}
