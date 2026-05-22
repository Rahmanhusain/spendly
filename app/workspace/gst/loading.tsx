export default function GstLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="h-9 w-56 rounded-lg bg-slate-200" />
        <div className="h-4 w-[480px] max-w-full rounded bg-slate-200" />
      </div>

      {/* Date range + export controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <div className="h-3 w-16 rounded bg-slate-200" />
          <div className="h-10 w-36 rounded-lg bg-slate-200" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-12 rounded bg-slate-200" />
          <div className="h-10 w-36 rounded-lg bg-slate-200" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-slate-200" />
        <div className="ml-auto h-10 w-36 rounded-lg bg-slate-200" />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-8 w-28 rounded-lg bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* GST breakdown table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="h-4 w-40 rounded bg-slate-300" />
        </div>
        {/* Header row */}
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 w-20 rounded bg-slate-300" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4 border-b border-slate-100 px-5 py-3 last:border-0"
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-4 rounded bg-slate-200" style={{ width: `${60 + (j * 10) % 40}%` }} />
            ))}
          </div>
        ))}
      </div>

      {/* Export history */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="h-5 w-32 rounded bg-slate-200" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
            <div className="space-y-1.5">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-3 w-28 rounded bg-slate-200" />
            </div>
            <div className="h-8 w-24 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
