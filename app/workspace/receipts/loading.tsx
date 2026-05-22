export default function ReceiptsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="h-9 w-52 rounded-lg bg-slate-200" />
        <div className="h-4 w-96 rounded bg-slate-200" />
      </div>

      {/* Toolbar: search + filters + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-64 rounded-lg bg-slate-200" />
        <div className="h-10 w-36 rounded-lg bg-slate-200" />
        <div className="h-10 w-36 rounded-lg bg-slate-200" />
        <div className="ml-auto h-10 w-32 rounded-lg bg-slate-200" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Table header */}
        <div className="grid grid-cols-[2rem_1fr_1fr_8rem_8rem_6rem] items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="h-4 w-4 rounded bg-slate-300" />
          <div className="h-3 w-20 rounded bg-slate-300" />
          <div className="h-3 w-16 rounded bg-slate-300" />
          <div className="h-3 w-16 rounded bg-slate-300" />
          <div className="h-3 w-14 rounded bg-slate-300" />
          <div className="h-3 w-12 rounded bg-slate-300" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[2rem_1fr_1fr_8rem_8rem_6rem] items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0"
          >
            <div className="h-4 w-4 rounded bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-3 w-24 rounded bg-slate-200" />
            </div>
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-6 w-20 rounded-full bg-slate-200" />
            <div className="h-8 w-16 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-lg bg-slate-200" />
          <div className="h-9 w-20 rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
