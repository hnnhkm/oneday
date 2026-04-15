export default function BookingsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-pulse">
      <div className="h-8 w-48 bg-charcoal-lighter/10 rounded mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-white shadow-card p-4 flex gap-4">
            <div className="w-24 h-24 rounded bg-charcoal-lighter/10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 bg-charcoal-lighter/10 rounded" />
              <div className="h-4 w-1/2 bg-charcoal-lighter/10 rounded" />
              <div className="h-4 w-1/3 bg-charcoal-lighter/10 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
