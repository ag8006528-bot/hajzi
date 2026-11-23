export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-5 w-24 animate-pulse rounded bg-white/20" />
      <div className="mt-5 h-14 w-80 max-w-full animate-pulse rounded-lg bg-white/20" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className="aspect-[16/10] animate-pulse rounded-2xl bg-white/20" />
        <div className="h-[520px] animate-pulse rounded-2xl bg-white/80" />
      </div>
    </div>
  );
}
