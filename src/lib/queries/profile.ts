import type { PreferredLanguage } from "@/lib/types/database";

export interface ProfileUpdate {
  name: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_language: PreferredLanguage;
}

export interface ProfileValidationError {
  field: keyof ProfileUpdate;
  message: string;
}

/**
 * Pure validator for profile updates. Returns the first error found
 * (UI shows one at a time), or null if the update is valid.
 * Rules:
 * - name: required, trimmed length >= 2, <= 100
 * - phone: optional; if provided, must look like a phone (digits/+/space/-, 8+ digits)
 * - avatar_url: optional; if provided, must be http(s) URL
 * - preferred_language: must be pt/en/es
 */
export function validateProfileUpdate(
  update: Partial<ProfileUpdate>
): ProfileValidationError | null {
  const name = (update.name || "").trim();
  if (name.length < 2) {
    return { field: "name", message: "Name must be at least 2 characters" };
  }
  if (name.length > 100) {
    return { field: "name", message: "Name must be at most 100 characters" };
  }

  if (update.phone) {
    const digits = update.phone.replace(/\D/g, "");
    if (digits.length < 8) {
      return { field: "phone", message: "Phone number is too short" };
    }
    if (!/^[\d+\-\s()]+$/.test(update.phone)) {
      return { field: "phone", message: "Phone contains invalid characters" };
    }
  }

  if (update.avatar_url) {
    try {
      const url = new URL(update.avatar_url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { field: "avatar_url", message: "Avatar URL must be http(s)" };
      }
    } catch {
      return { field: "avatar_url", message: "Avatar URL is not a valid URL" };
    }
  }

  if (
    update.preferred_language &&
    !["pt", "en", "es"].includes(update.preferred_language)
  ) {
    return {
      field: "preferred_language",
      message: "Language must be pt, en, or es",
    };
  }

  return null;
}
