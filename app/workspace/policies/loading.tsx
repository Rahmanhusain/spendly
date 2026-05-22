export default function PoliciesLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="h-9 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-[480px] max-w-full rounded bg-slate-200" />
      </div>

      {/* Policy panel card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        {/* Card header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="h-3 w-64 rounded bg-slate-200" />
          </div>
          <div className="h-9 w-24 rounded-lg bg-slate-200" />
        </div>

        <div className="border-t border-slate-100" />

        {/* Policy rule rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4"
          >
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-36 rounded bg-slate-200" />
              <div className="h-3 w-56 rounded bg-slate-200" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="h-9 w-28 rounded-lg bg-slate-200" />
              <div className="h-6 w-10 rounded-full bg-slate-200" />
            </div>
          </div>
        ))}

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <div className="h-10 w-28 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="h-3 w-full rounded bg-slate-200" />
        <div className="h-3 w-4/5 rounded bg-slate-200" />
        <div className="h-3 w-3/5 rounded bg-slate-200" />
      </div>
    </div>
  );
}
