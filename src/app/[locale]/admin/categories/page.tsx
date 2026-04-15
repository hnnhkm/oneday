import { getLocale, getTranslations } from "next-intl/server";
import { fetchCategories } from "@/lib/queries/categories";
import { AdminCategoryRow } from "@/components/admin/admin-category-row";
import { getTranslatedField } from "@/lib/utils";

/**
 * Admin curation surface for the homepage CategoryGrid. Lists the full
 * taxonomy (19 rows today, not many) with a toggle that writes the
 * `show_on_home` flag added in migration 00024. We fetch the full list
 * — `fetchCategories` — because the admin needs to manage both visible
 * and hidden rows here; `fetchHomeCategories` only returns the visible
 * subset and is reserved for the homepage itself.
 */
export default async function AdminCategoriesPage() {
  const t = await getTranslations("admin.categories");
  const locale = await getLocale();
  const categories = await fetchCategories();

  const visibleCount = categories.filter((c) => c.show_on_home).length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-charcoal-lighter mb-6">{t("subtitle")}</p>

      <div className="mb-4 text-sm text-charcoal-lighter">
        {t("visibleCount", { count: visibleCount, total: categories.length })}
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-16 text-charcoal-lighter">
          {t("empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <AdminCategoryRow
              key={c.id}
              categoryId={c.id}
              icon={c.icon}
              name={getTranslatedField(c.name, locale)}
              slug={c.slug}
              initialShowOnHome={c.show_on_home}
            />
          ))}
        </div>
      )}
    </div>
  );
}
