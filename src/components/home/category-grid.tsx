import { Link } from "@/i18n/navigation";
import { getTranslatedField } from "@/lib/utils";
import type { Category, TranslatedField } from "@/lib/types/database";

interface CategoryGridProps {
  categories: Category[];
  locale: string;
  title: string;
  seeAllLabel: string;
}

export function CategoryGrid({
  categories,
  locale,
  title,
  seeAllLabel,
}: CategoryGridProps) {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-2xl font-bold text-charcoal mb-6 text-center">
          {title}
        </h2>
        {/* Mobile (3-col) caps at 8 categories + 1 "see all" = 9 items =
            3 perfect rows. Extras are hidden until sm+ where the grid
            widens to 4 / 6 cols and all categories fit again. */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((category, i) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className={`${
                i >= 8 ? "hidden sm:flex" : "flex"
              } flex-col items-center gap-2 p-3 sm:p-4 rounded-lg bg-white shadow-card hover:shadow-card-hover transition-shadow text-center group`}
            >
              <span className="text-2xl sm:text-3xl">{category.icon}</span>
              <span className="text-xs sm:text-sm font-medium text-charcoal group-hover:text-primary-400 transition-colors">
                {getTranslatedField(category.name as TranslatedField, locale)}
              </span>
            </Link>
          ))}
          {/* "See all" card — always visible; on mobile it takes the 9th
              slot after the first 8 categories. */}
          <Link
            href="/activities"
            className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg border-2 border-dashed border-charcoal-lighter/20 hover:border-primary-400 transition-colors text-center group"
          >
            <span className="text-2xl sm:text-3xl">→</span>
            <span className="text-xs sm:text-sm font-medium text-charcoal-lighter group-hover:text-primary-400 transition-colors">
              {seeAllLabel}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
