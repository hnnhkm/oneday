import { useTranslations } from "next-intl";
import { ExpandedSearchBar } from "@/components/activities/search/expanded-search-bar";
import { HeroCarousel } from "./hero-carousel";
import type { Category } from "@/lib/types/database";

const HERO_SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=2000&q=80",
    alt: "Cooking class",
  },
  {
    src: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=2000&q=80",
    alt: "Street photography",
  },
  {
    src: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=2000&q=80",
    alt: "Outdoor yoga",
  },
  {
    src: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=2000&q=80",
    alt: "Watercolor painting",
  },
  {
    src: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=2000&q=80",
    alt: "Urban gardening",
  },
];

interface HeroSectionProps {
  categories: Category[];
  locale: string;
}

export function HeroSection({ categories, locale }: HeroSectionProps) {
  const t = useTranslations("home");

  return (
    <HeroCarousel slides={HERO_SLIDES}>
      <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight drop-shadow-lg">
        {t("heroTitle")}
      </h1>
      <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-md">
        {t("heroSubtitle")}
      </p>
      <div className="max-w-2xl mx-auto pb-4">
        <ExpandedSearchBar categories={categories} locale={locale} />
      </div>
    </HeroCarousel>
  );
}
