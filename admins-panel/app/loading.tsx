function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />
  );
}

export default function RootLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3 text-center">
          <SkeletonBlock className="mx-auto h-8 w-32" />
          <SkeletonBlock className="mx-auto h-4 w-24" />
        </div>
        <SkeletonBlock className="h-36 w-full rounded-2xl" />
        <div className="space-y-3">
          <SkeletonBlock className="h-10 w-full rounded-lg" />
          <SkeletonBlock className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}
