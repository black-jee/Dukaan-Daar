export default function DashboardLoading() {
  return (
    <div className="space-y-5" aria-live="polite" aria-busy="true">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
