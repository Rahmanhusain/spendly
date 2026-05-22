export default function ApprovalsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-9 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-96 rounded bg-slate-200" />
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-8 w-8 rounded-full bg-slate-200" />
            </div>
            <div className="h-7 w-16 rounded-lg bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-56 rounded-lg bg-slate-200" />
        <div className="h-10 w-32 rounded-lg bg-slate-200" />
      </div>

      {/* Approval cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-5 w-52 rounded bg-slate-200" />
              <div className="h-3 w-40 rounded bg-slate-200" />
              <div className="flex gap-3 pt-1">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-200" />
              </div>
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-200" />
          </div>
          {/* Receipt line items preview */}
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="h-3 w-40 rounded bg-slate-200" />
                <div className="h-3 w-16 rounded bg-slate-200" />
              </div>
            ))}
          </div>
          {/* Action buttons */}
          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <div className="h-9 w-24 rounded-lg bg-slate-200" />
            <div className="h-9 w-24 rounded-lg bg-slate-200" />
            <div className="h-9 w-28 rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
