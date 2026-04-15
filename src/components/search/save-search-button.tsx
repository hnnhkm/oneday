"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSavedSearchAction } from "@/lib/actions/saved-searches";
import type { SavedSearchFilters } from "@/lib/saved-search-validation";

interface SaveSearchButtonProps {
  isAuthed: boolean;
}

/**
 * Reads the current URL search params and offers to save them as a
 * named saved search. Only renders when the user is authenticated
 * and at least one filter is active.
 */
export function SaveSearchButton({ isAuthed }: SaveSearchButtonProps) {
  const t = useTranslations("savedSearches");
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isAuthed) return null;

  // Build filters from URL params.
  const filters: SavedSearchFilters = {};
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const neighborhood = searchParams.get("neighborhood");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  if (search) filters.search = search;
  if (category) filters.categoryIds = category.split(",").filter(Boolean);
  if (neighborhood) filters.neighborhood = neighborhood;
  if (minPrice) filters.minPrice = parseInt(minPrice) * 100;
  if (maxPrice) filters.maxPrice = parseInt(maxPrice) * 100;

  // Only show the button when at least one filter is active.
  const hasFilters = Object.keys(filters).length > 0;
  if (!hasFilters) return null;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await createSavedSearchAction(name, filters);
      if (!result.ok) {
        setError(result.error || t("errorGeneric"));
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setName("");
      }, 1500);
    });
  }

  if (success) {
    return (
      <span className="text-sm text-secondary-500 font-medium">
        {t("saved")}
      </span>
    );
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-primary-400"
      >
        {t("saveButton")}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("namePlaceholder")}
        className="text-sm w-48"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim()}>
        {isPending ? "..." : t("confirmSave")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
      >
        {t("cancel")}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
