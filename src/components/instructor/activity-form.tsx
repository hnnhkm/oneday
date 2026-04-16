"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CoverImageUploader,
  GalleryImageUploader,
} from "@/components/instructor/image-uploader";
import {
  createActivityAction,
  updateActivityAction,
  publishActivityAction,
} from "@/lib/actions/instructor";
import {
  forwardGeocodeAction,
  reverseGeocodeAction,
} from "@/lib/actions/geocoding";
import { cn, formatDurationHours } from "@/lib/utils";
import type { ActivityInput } from "@/lib/activity-validation";
import type { CancellationPolicy } from "@/lib/types/database";

// Leaflet touches window at module load, so we MUST dynamic-import
// with ssr:false. The wrapper is client-only either way, but Next
// still tries to pre-render it during build otherwise.
const LocationMapPicker = dynamic(
  () =>
    import("@/components/instructor/location-map-picker").then(
      (m) => m.LocationMapPicker
    ),
  { ssr: false }
);

interface Category {
  id: string;
  slug: string;
  name: { pt: string; en?: string; es?: string };
  icon: string;
}

interface Props {
  mode: "new" | "edit";
  activityId?: string;
  initial?: ActivityInput;
  categories: Category[];
}

type Locale = "pt" | "en" | "es";

function emptyInput(): ActivityInput {
  return {
    title: { pt: "", en: "", es: "" },
    description: { pt: "", en: "", es: "" },
    category_id: "",
    tags: [],
    price_cents: 5000,
    date: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
    time: "10:00",
    duration_minutes: 60,
    address: "",
    neighborhood: "",
    city: "São Paulo",
    state: "SP",
    max_seats: 10,
    min_participants: 0,
    cover_image_url: "",
    gallery_image_urls: [],
    cancellation_policy: "flexible",
    cancellation_policy_text: null,
    no_show_fee_cents: null,
  };
}

export function ActivityForm({ mode, activityId, initial, categories }: Props) {
  const t = useTranslations("instructor.form");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState<ActivityInput>(initial || emptyInput());
  const [locale, setLocale] = useState<Locale>("pt");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [priceReais, setPriceReais] = useState(
    ((initial?.price_cents || 5000) / 100).toString()
  );

  const update = <K extends keyof ActivityInput>(
    key: K,
    value: ActivityInput[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  const updateTitle = (l: Locale, v: string) =>
    setForm((f) => ({ ...f, title: { ...f.title, [l]: v } }));
  const updateDescription = (l: Locale, v: string) =>
    setForm((f) => ({ ...f, description: { ...f.description, [l]: v } }));

  const onPriceChange = (raw: string) => {
    setPriceReais(raw);
    const n = Number(raw.replace(",", "."));
    if (!Number.isNaN(n)) update("price_cents", Math.round(n * 100));
  };

  const onVerifyAddress = async () => {
    setGeocodeError(null);
    if (!form.address.trim() || !form.city.trim() || !form.state.trim()) {
      setGeocodeError(t("addressNotFound"));
      return;
    }
    setGeocoding(true);
    try {
      const result = await forwardGeocodeAction(
        form.address,
        form.city,
        form.state
      );
      if (!result) {
        setGeocodeError(t("addressNotFound"));
        return;
      }
      setForm((f) => ({ ...f, latitude: result.lat, longitude: result.lng }));
    } finally {
      setGeocoding(false);
    }
  };

  const onPinChange = async (lat: number, lng: number) => {
    // Optimistic update so the marker snaps to where the user dropped it
    setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
    // Fire-and-forget reverse geocode. If it fails or returns empty
    // fields we just keep the user's manual text. Only non-empty
    // returned values overwrite the form.
    const result = await reverseGeocodeAction(lat, lng);
    if (!result) return;
    setForm((f) => ({
      ...f,
      address: result.address || f.address,
      neighborhood: result.neighborhood || f.neighborhood,
      city: result.city || f.city,
      state: result.state || f.state,
    }));
  };

  const save = async (andPublish: boolean) => {
    setError(null);
    setFieldError(null);
    setNotice(null);
    startTransition(async () => {
      let result;
      if (mode === "new") {
        result = await createActivityAction(form);
      } else if (activityId) {
        result = await updateActivityAction(activityId, form);
      } else {
        return;
      }
      if (!result.ok) {
        setFieldError(result.field || null);
        setError(result.error || t("errorGeneric"));
        return;
      }
      const id =
        (result as { activityId?: string }).activityId || activityId || null;
      if (andPublish && id) {
        const pub = await publishActivityAction(id);
        if (!pub.ok) {
          setError(pub.error || t("errorCannotPublish"));
          setNotice(null);
          router.refresh();
          return;
        }
        setNotice(t("published"));
      } else {
        setNotice(t("savedDraft"));
      }
      if (mode === "new" && id) {
        router.push(
          `/instructor/activities/${id}/edit` as "/instructor/activities"
        );
      } else {
        router.refresh();
      }
    });
  };

  const addTag = (raw: string) => {
    const v = raw.trim();
    if (!v || form.tags.includes(v)) return;
    update("tags", [...form.tags, v]);
  };
  const removeTag = (tag: string) =>
    update(
      "tags",
      form.tags.filter((t) => t !== tag)
    );

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
        {mode === "new" ? t("newTitle") : t("editTitle")}
      </h1>

      {/* Section: Basic */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          {t("sectionBasic")}
        </h2>

        <div className="flex gap-1 mb-3 text-xs">
          {(["pt", "en", "es"] as Locale[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={cn(
                "px-3 py-1 rounded-md font-medium",
                locale === l
                  ? "bg-primary-100 text-primary-600"
                  : "bg-background-muted text-charcoal-lighter hover:text-charcoal"
              )}
            >
              {l.toUpperCase()}
              {l === "pt" ? " *" : ""}
            </button>
          ))}
        </div>

        <Input
          id="title"
          label={t("titleLabel")}
          value={form.title[locale] || ""}
          onChange={(e) => updateTitle(locale, e.target.value)}
          error={fieldError === "title" && locale === "pt" ? error || undefined : undefined}
          placeholder={locale === "pt" ? "" : "Fallback: PT"}
        />

        <div className="mt-4">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            {t("descriptionLabel")}
          </label>
          <textarea
            id="description"
            value={form.description[locale] || ""}
            onChange={(e) => updateDescription(locale, e.target.value)}
            rows={5}
            placeholder={locale === "pt" ? "" : "Fallback: PT"}
            className="w-full rounded border border-charcoal-lighter/30 bg-white px-4 py-2.5 text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
          {fieldError === "description" && locale === "pt" && error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="mt-4">
          <label
            htmlFor="category"
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            {t("categoryLabel")}
          </label>
          <Select
            value={form.category_id}
            onValueChange={(v) => update("category_id", v)}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder={t("categorySelect")} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon} {c.name.pt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError === "category_id" && error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            {t("tagsLabel")}
          </label>
          <Input
            type="text"
            placeholder={t("tagsHelp")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label="remove"
                    className="text-primary-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section: When & Where */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          {t("sectionWhenWhere")}
        </h2>
        {/*
          Phase 6A: date + time live on `activity_sessions` now, not on
          the activity template. In "new" mode we still collect one
          date/time pair — the create action writes it as the activity's
          first session via the mirror trigger. In "edit" mode the
          SessionsManager panel on the same page owns per-session
          date/time edits, so we hide the inputs here to avoid giving
          the instructor two places to change the same value.
          Duration_minutes stays on the activity row (shared by every
          session) and is editable in both modes.
        */}
        <div
          className={
            mode === "new"
              ? "grid grid-cols-1 md:grid-cols-3 gap-4"
              : "grid grid-cols-1 md:grid-cols-1 gap-4"
          }
        >
          {mode === "new" && (
            <>
              <Input
                id="date"
                label={t("dateLabel")}
                type="date"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
              />
              <Input
                id="time"
                label={t("timeLabel")}
                type="time"
                value={form.time}
                onChange={(e) => update("time", e.target.value)}
              />
            </>
          )}
          <div className="w-full">
            <label
              htmlFor="duration"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              {t("durationLabel")}
            </label>
            <Select
              value={String(form.duration_minutes)}
              onValueChange={(v) => update("duration_minutes", Number(v))}
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 16 }, (_, i) => (i + 1) * 30).map(
                  (mins) => (
                    <SelectItem key={mins} value={String(mins)}>
                      {formatDurationHours(mins)}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            id="address"
            label={t("addressLabel")}
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
          <Input
            id="neighborhood"
            label={t("neighborhoodLabel")}
            value={form.neighborhood}
            onChange={(e) => update("neighborhood", e.target.value)}
          />
          <Input
            id="city"
            label={t("cityLabel")}
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
          />
          <Input
            id="state"
            label={t("stateLabel")}
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-charcoal">
              {t("mapLabel")}
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onVerifyAddress}
              disabled={geocoding}
            >
              {geocoding ? t("verifying") : t("verifyAddress")}
            </Button>
          </div>
          <LocationMapPicker
            latitude={form.latitude ?? null}
            longitude={form.longitude ?? null}
            onPinChange={onPinChange}
          />
          {form.latitude != null && form.longitude != null && (
            <p className="mt-1 text-xs text-charcoal-lighter">
              {t("addressVerified", {
                lat: form.latitude.toFixed(5),
                lng: form.longitude.toFixed(5),
              })}
            </p>
          )}
          {geocodeError && (
            <p className="mt-1 text-xs text-red-600">{geocodeError}</p>
          )}
        </div>
      </section>

      {/* Section: Pricing */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          {t("sectionPricing")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="price"
            label={t("priceLabel")}
            type="text"
            inputMode="decimal"
            value={priceReais}
            onChange={(e) => onPriceChange(e.target.value)}
            error={fieldError === "price_cents" ? error || undefined : undefined}
          />
          {/*
            Phase 6A: max_seats lives on `activity_sessions` now. Keep
            the input in "new" mode (seeds the first session) but hide
            it in "edit" mode — SessionsManager handles per-session
            seat changes.
          */}
          {mode === "new" && (
            <Input
              id="max_seats"
              label={t("maxSeatsLabel")}
              type="number"
              min={1}
              max={50}
              value={form.max_seats}
              onChange={(e) => update("max_seats", Number(e.target.value))}
            />
          )}
          <div>
            <label
              htmlFor="min_participants"
              className="block text-sm font-medium text-charcoal mb-1"
            >
              {t("minParticipantsLabel")}
            </label>
            <input
              type="number"
              id="min_participants"
              min={0}
              max={form.max_seats}
              value={form.min_participants}
              onChange={(e) => update("min_participants", Number(e.target.value))}
              className="w-full rounded-md border border-charcoal-lighter/20 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <p className="mt-1 text-xs text-charcoal-lighter">
              {t("minParticipantsHint")}
            </p>
          </div>
          <div>
            <label
              htmlFor="policy"
              className="block text-sm font-medium text-charcoal mb-1.5"
            >
              {t("policyLabel")}
            </label>
            <Select
              value={form.cancellation_policy}
              onValueChange={(v) =>
                update("cancellation_policy", v as CancellationPolicy)
              }
            >
              <SelectTrigger id="policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flexible">{t("policyFlexible")}</SelectItem>
                <SelectItem value="moderate">{t("policyModerate")}</SelectItem>
                <SelectItem value="strict">{t("policyStrict")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            id="no_show_fee"
            label={t("noShowFeeLabel")}
            type="number"
            min={0}
            value={form.no_show_fee_cents ? form.no_show_fee_cents / 100 : ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              update(
                "no_show_fee_cents",
                Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
              );
            }}
          />
        </div>
      </section>

      {/* Section: Images */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          {t("sectionImages")}
        </h2>
        <div className="mb-6">
          <label className="block text-sm font-medium text-charcoal mb-2">
            {t("coverLabel")}
          </label>
          <CoverImageUploader
            value={form.cover_image_url}
            onChange={(url) => update("cover_image_url", url)}
          />
          {fieldError === "cover_image_url" && error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            {t("galleryLabel")}
          </label>
          {/* Running counter so the instructor can see how close they
              are to the 4-gallery-minimum (cover + 4 = 5 total required
              by validateActivityInput). Turns green once satisfied. */}
          <p
            className={cn(
              "mb-2 text-xs",
              form.gallery_image_urls.length >= 4
                ? "text-secondary-500"
                : "text-charcoal-lighter"
            )}
          >
            {t("galleryCount", {
              count: form.gallery_image_urls.length,
              min: 4,
            })}
          </p>
          <GalleryImageUploader
            value={form.gallery_image_urls}
            onChange={(urls) => update("gallery_image_urls", urls)}
          />
          {fieldError === "gallery_image_urls" && error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>
      </section>

      {error && !fieldError && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm mb-4">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md bg-secondary-50 border border-secondary-200 text-secondary-700 px-3 py-2 text-sm mb-4">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => save(false)}
          disabled={pending}
        >
          {pending ? t("saving") : t("saveDraft")}
        </Button>
        <Button onClick={() => save(true)} disabled={pending}>
          {pending ? t("saving") : t("publish")}
        </Button>
      </div>
    </div>
  );
}
