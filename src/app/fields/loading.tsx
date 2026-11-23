export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-14 w-64 animate-pulse rounded-lg bg-white/20" />
      <div className="mt-4 h-5 w-96 max-w-full animate-pulse rounded bg-white/15" />
      <div className="mt-10 h-24 animate-pulse rounded-2xl bg-white/20" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white/90">
            <div className="aspect-[16/10] animate-pulse bg-pitch-light/40" />
            <div className="space-y-3 p-5">
              <div className="h-6 w-2/3 animate-pulse rounded bg-ink/10" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-ink/10" />
              <div className="h-10 animate-pulse rounded-full bg-ink/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
