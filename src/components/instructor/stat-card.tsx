interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}

export function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-lg bg-white shadow-card p-4">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-lg"
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-charcoal-lighter">{label}</div>
          <div className="text-base sm:text-xl font-semibold text-charcoal">
            {value}
          </div>
          {sub && (
            <div className="text-xs text-charcoal-lighter truncate">{sub}</div>
          )}
        </div>
      </div>
    </div>
  );
}
