export default function ReportDetailLoading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Header / breadcrumb */}
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="h-8 w-64 rounded-lg bg-slate-200" />
        <div className="h-4 w-48 rounded bg-slate-200" />
      </div>

      {/* Main workspace grid */}
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        {/* Left: report list sidebar */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="h-4 w-28 rounded bg-slate-300" />
          </div>
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-100 px-4 py-3 space-y-2"
                style={{ opacity: i === 0 ? 1 : 0.6 - i * 0.08 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-40 rounded bg-slate-200" />
                    <div className="h-3 w-28 rounded bg-slate-200" />
                  </div>
                  <div className="h-6 w-16 rounded-full bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: report detail */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          {/* Report header */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-6 w-56 rounded-lg bg-slate-200" />
                <div className="h-4 w-80 rounded bg-slate-200" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-24 rounded-lg bg-slate-200" />
                <div className="h-9 w-24 rounded-lg bg-slate-200" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <div className="h-6 w-20 rounded-full bg-slate-200" />
              <div className="h-6 w-24 rounded-full bg-slate-200" />
              <div className="h-6 w-20 rounded-full bg-slate-200" />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Receipt line items */}
          <div className="space-y-3">
            <div className="h-4 w-32 rounded bg-slate-200" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-36 rounded bg-slate-200" />
                    <div className="h-3 w-48 rounded bg-slate-200" />
                    <div className="h-3 w-32 rounded bg-slate-200" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="h-8 w-28 rounded-lg bg-slate-200" />
                    <div className="h-3 w-20 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Activity / comments */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="h-4 w-28 rounded bg-slate-200" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
