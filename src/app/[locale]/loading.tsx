export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse">
      <div className="h-8 w-48 bg-charcoal-lighter/10 rounded mb-6 mx-auto" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-white shadow-card overflow-hidden">
            <div className="aspect-[4/3] bg-charcoal-lighter/10" />
            <div className="p-4 space-y-3">
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
