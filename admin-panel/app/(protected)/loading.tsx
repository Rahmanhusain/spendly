function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />
  );
}

export default function ProtectedLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        <SkeletonBlock className="h-9 w-24 rounded-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <SkeletonBlock className="h-3 w-24 rounded-full" />
                <SkeletonBlock className="h-8 w-16" />
              </div>
              <SkeletonBlock className="h-8 w-8 rounded-full" />
            </div>
            <SkeletonBlock className="mt-4 h-3 w-32" />
            <SkeletonBlock className="mt-3 h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="mt-2 h-4 w-56" />
          </div>
          <div className="space-y-4 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"
              >
                <SkeletonBlock className="h-8 w-8 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-3/5" />
                  <SkeletonBlock className="h-3 w-1/2" />
                </div>
                <SkeletonBlock className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-5 w-28" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
