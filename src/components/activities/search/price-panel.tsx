"use client";

import { useTranslations } from "next-intl";

interface PricePanelProps {
  minPrice: string;
  maxPrice: string;
  onChange: (min: string, max: string) => void;
}

export function PricePanel({ minPrice, maxPrice, onChange }: PricePanelProps) {
  const t = useTranslations("activities");

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-charcoal-lighter mb-1">
            {t("minPrice")}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal-lighter">R$</span>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => onChange(e.target.value, maxPrice)}
              placeholder="0"
              className="w-full rounded-lg border border-charcoal-lighter/30 bg-white pl-9 pr-3 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
        </div>
        <span className="text-charcoal-lighter mt-5">–</span>
        <div className="flex-1">
          <label className="block text-xs font-medium text-charcoal-lighter mb-1">
            {t("maxPrice")}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal-lighter">R$</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => onChange(minPrice, e.target.value)}
              placeholder="500+"
              className="w-full rounded-lg border border-charcoal-lighter/30 bg-white pl-9 pr-3 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
