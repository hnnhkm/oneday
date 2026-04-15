import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroSection } from "@/components/home/hero-section";
import { CategoryGrid } from "@/components/home/category-grid";
import { WeeklyDateStrip } from "@/components/home/weekly-date-strip";
import { HowItWorks } from "@/components/home/how-it-works";
import { FeaturedActivities } from "@/components/home/featured-activities";
import { fetchFeaturedActivities } from "@/lib/queries/activities";
import {
  fetchCategories,
  fetchHomeCategories,
} from "@/lib/queries/categories";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // HeroSection's search bar and the CategoryGrid have different needs:
  // the search bar wants the full taxonomy so users can filter by any
  // category, while the grid only shows the admin-curated subset. Fetch
  // both in parallel.
  const [categories, homeCategories, featuredActivities] = await Promise.all([
    fetchCategories(),
    fetchHomeCategories(),
    fetchFeaturedActivities(10),
  ]);

  return (
    <>
      <HeroSection categories={categories} locale={locale} />

      <CategoryGrid
        categories={homeCategories}
        locale={locale}
        title={t("home.categoriesTitle")}
        seeAllLabel={t("common.seeAll")}
      />

      <WeeklyDateStrip
        locale={locale}
        title={t("home.exploreByDateTitle")}
        seeAllLabel={t("common.seeAll")}
      />

      <FeaturedActivities
        activities={featuredActivities}
        locale={locale}
        title={t("home.featuredTitle")}
        seeAllLabel={t("common.seeAll")}
      />

      <HowItWorks />
    </>
  );
}
