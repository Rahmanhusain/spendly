export default function ReceiptDetailLoading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 rounded bg-slate-200" />
        <div className="h-9 w-36 rounded-lg bg-slate-200" />
      </div>

      {/* Detail panel */}
      <div className="grid gap-5 xl:grid-cols-1">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          {/* Two-column layout */}
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Preview pane */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="h-3 w-16 rounded bg-slate-300" />
              <div className="h-64 rounded-lg bg-slate-200" />
            </div>

            {/* Metadata pane */}
            <div className="space-y-4">
              {/* Status + actions */}
              <div className="flex items-center gap-3">
                <div className="h-6 w-20 rounded-full bg-slate-200" />
                <div className="h-6 w-24 rounded-full bg-slate-200" />
              </div>

              {/* Field rows */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-20 rounded bg-slate-300" />
                  <div className="h-5 w-40 rounded bg-slate-200" />
                </div>
              ))}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <div className="h-10 w-24 rounded-xl bg-slate-200" />
                <div className="h-10 w-24 rounded-xl bg-slate-200" />
              </div>
            </div>
          </div>

          {/* Comments section */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="h-4 w-24 rounded bg-slate-200" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-200" />
                </div>
              </div>
            ))}
            <div className="h-20 rounded-lg bg-slate-200" />
            <div className="h-9 w-28 rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
