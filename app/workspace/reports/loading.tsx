export default function ReportsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-9 w-44 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 rounded bg-slate-200" />
      </div>

      {/* Tabs row */}
      <div className="flex gap-1 border-b border-slate-200">
        {["All", "Draft", "Submitted", "Approved"].map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 rounded-t-lg bg-slate-200"
            style={{ opacity: i === 0 ? 1 : 0.5 }}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-56 rounded-lg bg-slate-200" />
        <div className="h-10 w-32 rounded-lg bg-slate-200" />
        <div className="ml-auto h-10 w-36 rounded-lg bg-slate-200" />
      </div>

      {/* Report cards */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-5 w-56 rounded bg-slate-200" />
              <div className="h-3 w-72 rounded bg-slate-200" />
              <div className="flex gap-3 pt-1">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="h-3 w-16 rounded bg-slate-200" />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="h-6 w-20 rounded-full bg-slate-200" />
              <div className="h-5 w-16 rounded bg-slate-200" />
            </div>
          </div>
          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <div className="h-8 w-24 rounded-lg bg-slate-200" />
            <div className="h-8 w-24 rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}

      {/* Load more */}
      <div className="flex justify-center pt-2">
        <div className="h-10 w-32 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}
