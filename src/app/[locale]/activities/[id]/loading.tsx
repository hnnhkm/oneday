export default function ActivityDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <div className="aspect-[16/9] bg-charcoal-lighter/10 rounded-lg mb-6" />
          <div className="space-y-3">
            <div className="h-7 w-3/4 bg-charcoal-lighter/10 rounded" />
            <div className="h-4 w-1/2 bg-charcoal-lighter/10 rounded" />
            <div className="h-4 w-full bg-charcoal-lighter/10 rounded" />
            <div className="h-4 w-full bg-charcoal-lighter/10 rounded" />
            <div className="h-4 w-2/3 bg-charcoal-lighter/10 rounded" />
          </div>
        </div>
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="rounded-lg bg-white shadow-card p-6 space-y-4">
            <div className="h-8 w-1/2 bg-charcoal-lighter/10 rounded" />
            <div className="h-4 w-3/4 bg-charcoal-lighter/10 rounded" />
            <div className="h-4 w-2/3 bg-charcoal-lighter/10 rounded" />
            <div className="h-12 w-full bg-charcoal-lighter/10 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
