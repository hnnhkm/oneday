/**
 * Pure validation for saved search input. No server-only imports.
 */

export interface SavedSearchFilters {
  categoryIds?: string[];
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export interface SavedSearchInput {
  name: string;
  filters: SavedSearchFilters;
}

export interface SavedSearchValidationError {
  field: "name" | "filters";
  message: string;
}

/**
 * Returns null on success or a structured error.
 *
 * Rules:
 * - name: required, trimmed length 1–100
 * - filters: at least one non-empty criterion must be set
 */
export function validateSavedSearchInput(
  input: SavedSearchInput
): SavedSearchValidationError | null {
  const name = input.name.trim();
  if (name.length === 0) {
    return { field: "name", message: "Name is required" };
  }
  if (name.length > 100) {
    return { field: "name", message: "Name must be at most 100 characters" };
  }

  if (!hasAnyFilter(input.filters)) {
    return { field: "filters", message: "At least one filter is required" };
  }

  return null;
}

function hasAnyFilter(f: SavedSearchFilters): boolean {
  if (f.categoryIds && f.categoryIds.length > 0) return true;
  if (f.neighborhood && f.neighborhood.trim().length > 0) return true;
  if (f.minPrice != null && f.minPrice > 0) return true;
  if (f.maxPrice != null && f.maxPrice > 0) return true;
  if (f.search && f.search.trim().length > 0) return true;
  return false;
}
