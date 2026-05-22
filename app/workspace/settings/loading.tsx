export default function SettingsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header section with summary cards */}
      <div className="border-b border-slate-200 bg-white px-6 py-6 lg:px-8 lg:py-8 rounded-2xl border space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-9 w-56 rounded-lg bg-slate-200" />
            <div className="h-4 w-80 rounded bg-slate-200" />
          </div>
          <div className="h-10 w-24 rounded-lg bg-slate-200" />
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-slate-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 rounded bg-slate-200" />
                  <div className="h-3 w-32 rounded bg-slate-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profile editor */}
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6 lg:px-8 space-y-5">
        <div className="h-5 w-36 rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-10 w-full rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <div className="h-10 w-28 rounded-lg bg-slate-200" />
          <div className="h-10 w-24 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Additional info cards */}
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6 lg:px-8 space-y-4">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
            >
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-3 w-full rounded bg-slate-200" />
              <div className="h-3 w-4/5 rounded bg-slate-200" />
              <div className="h-3 w-3/5 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
