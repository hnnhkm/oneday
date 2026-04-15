export default function InstructorLoading() {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full animate-pulse">
      <div className="h-8 w-64 bg-charcoal-lighter/10 rounded mb-6" />
      <div className="grid grid-cols-2 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-white shadow-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-charcoal-lighter/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 bg-charcoal-lighter/10 rounded" />
                <div className="h-5 w-12 bg-charcoal-lighter/10 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
