export default function NotificationsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="h-9 w-44 rounded-lg bg-slate-200" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {["All", "Receipts", "Reports"].map((_, i) => (
          <div
            key={i}
            className="h-9 w-20 rounded-t-lg bg-slate-200"
            style={{ opacity: i === 0 ? 1 : 0.5 }}
          />
        ))}
      </div>

      {/* Mark all read button area */}
      <div className="flex justify-end">
        <div className="h-8 w-28 rounded-lg bg-slate-200" />
      </div>

      {/* Notification items */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4"
        >
          {/* Icon */}
          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200" />
          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="h-4 w-52 rounded bg-slate-200" />
            <div className="h-3 w-full max-w-md rounded bg-slate-200" />
            <div className="h-3 w-3/4 max-w-sm rounded bg-slate-200" />
            <div className="flex items-center justify-between pt-1">
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="h-4 w-12 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
