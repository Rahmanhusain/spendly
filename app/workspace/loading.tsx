export default function WorkspaceLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Hero banner */}
      <div className="overflow-hidden rounded-4xl border border-slate-200 bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
          {/* Left: welcome text + actions */}
          <div className="space-y-4">
            <div className="h-5 w-36 rounded-full bg-slate-200" />
            <div className="h-9 w-72 rounded-lg bg-slate-200" />
            <div className="h-4 w-56 rounded bg-slate-200" />
            <div className="mt-2 flex flex-wrap gap-3">
              <div className="h-11 w-36 rounded-xl bg-slate-200" />
              <div className="h-11 w-32 rounded-xl bg-slate-200" />
              <div className="h-11 w-32 rounded-xl bg-slate-200" />
              <div className="h-11 w-32 rounded-xl bg-slate-200" />
            </div>
          </div>
          {/* Right: pulse card */}
          <div className="space-y-3 rounded-3xl border border-slate-200 p-4">
            <div className="h-24 rounded-2xl bg-slate-200" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="h-16 rounded-2xl bg-slate-200" />
              <div className="h-16 rounded-2xl bg-slate-200" />
              <div className="h-16 rounded-2xl bg-slate-200" />
              <div className="h-16 rounded-2xl bg-slate-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Date range selector */}
      <div className="h-20 rounded-xl border border-slate-200 bg-white" />

      {/* Summary cards — 4 columns */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="h-9 w-9 rounded-full bg-slate-200" />
            </div>
            <div className="h-8 w-24 rounded-lg bg-slate-200" />
            <div className="h-3 w-36 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Spend timeline + category split */}
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="min-h-[400px] rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="h-5 w-36 rounded bg-slate-200" />
          <div className="h-3 w-48 rounded bg-slate-200" />
          <div className="h-64 rounded-xl bg-slate-200" />
        </div>
        <div className="min-h-[400px] rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="h-3 w-44 rounded bg-slate-200" />
          <div className="flex items-center gap-6 pt-2">
            <div className="h-48 w-48 shrink-0 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-200" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity + queue */}
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="h-5 w-36 rounded bg-slate-200" />
          <div className="h-3 w-64 rounded bg-slate-200" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-slate-100 p-4">
              <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="h-3 w-64 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-200" />
              </div>
              <div className="h-3 w-16 shrink-0 rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="h-5 w-32 rounded bg-slate-200" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl border border-slate-100 bg-slate-200" />
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
            <div className="h-5 w-36 rounded bg-slate-200" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl border border-slate-100 bg-slate-200" />
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions + signals */}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <div className="h-5 w-28 rounded bg-slate-200" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-2xl border border-slate-100 bg-slate-200" />
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <div className="h-5 w-36 rounded bg-slate-200" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl border border-slate-100 bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
