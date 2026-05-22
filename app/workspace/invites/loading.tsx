export default function InvitesLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page header card */}
      <div className="rounded-4xl border border-slate-200 bg-white p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-9 w-72 rounded-lg bg-slate-200" />
            <div className="h-4 w-80 rounded bg-slate-200" />
          </div>
          <div className="h-11 w-36 rounded-xl bg-slate-200" />
        </div>

        {/* Two-column grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Team members card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="space-y-1">
              <div className="h-5 w-40 rounded bg-slate-200" />
              <div className="h-3 w-32 rounded bg-slate-200" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-36 rounded bg-slate-200" />
                    <div className="h-3 w-48 rounded bg-slate-200" />
                    <div className="h-3 w-32 rounded bg-slate-200" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-14 rounded-full bg-slate-200" />
                    <div className="h-8 w-8 rounded-lg bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pending invites card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="space-y-1">
              <div className="h-5 w-36 rounded bg-slate-200" />
              <div className="h-3 w-44 rounded bg-slate-200" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-44 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-200" />
                  <div className="h-3 w-36 rounded bg-slate-200" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-16 rounded-full bg-slate-200" />
                  <div className="h-8 w-8 rounded-lg bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
