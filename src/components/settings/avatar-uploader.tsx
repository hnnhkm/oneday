"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resizeImage } from "@/lib/image-resize";
import { uploadAvatarAction } from "@/lib/actions/account";

interface AvatarUploaderProps {
  /** Current avatar URL. Empty string means "no photo yet". */
  value: string;
  /**
   * Called with the newly uploaded URL after a successful upload, or
   * with "" when the user clicks remove. The parent form owns the
   * state and persists it via its own save action.
   */
  onChange: (url: string) => void;
  /** User's display name — first letter shown as a fallback avatar. */
  fallbackLetter?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
// Avatars are rendered at 80–120px in most places; 512px gives us
// room for retina displays without sending full-resolution photos.
const AVATAR_MAX_WIDTH = 512;

/**
 * Profile photo uploader used on the settings page.
 *
 * Mirrors the pattern in `instructor/image-uploader.tsx`
 * (`CoverImageUploader`) but targets the `avatars` bucket through
 * `uploadAvatarAction`, which is open to any authenticated user (not
 * just approved instructors).
 *
 * UX:
 *   - If `value` is empty, shows a circular placeholder (letter or
 *     person icon) plus a primary "Upload" button.
 *   - If `value` is set, shows the photo in a circle with a small
 *     floating × to remove, and a secondary button to replace.
 *
 * The parent form must call `updateProfileAction` to persist the URL
 * onto `users.avatar_url`. Until then, the uploaded file lives in
 * storage but isn't linked to the user — harmless and cheap.
 */
export function AvatarUploader({
  value,
  onChange,
  fallbackLetter,
}: AvatarUploaderProps) {
  const t = useTranslations("settings");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("avatarTooLarge"));
      return;
    }
    setUploading(true);
    try {
      const blob = await resizeImage(file, { maxWidth: AVATAR_MAX_WIDTH });
      const fd = new FormData();
      fd.append(
        "file",
        new File([blob], "avatar.jpg", { type: "image/jpeg" })
      );
      const res = await uploadAvatarAction(fd);
      if (res.ok && res.url) onChange(res.url);
      else setError(res.error || t("avatarUploadError"));
    } catch {
      setError(t("avatarUploadError"));
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative">
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt=""
                className="w-20 h-20 rounded-full object-cover border border-charcoal-lighter/10"
              />
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label={t("avatarRemove")}
                className="absolute -top-1 -right-1 bg-white hover:bg-background-muted rounded-full w-6 h-6 flex items-center justify-center shadow border border-charcoal-lighter/20 text-charcoal-lighter"
                disabled={uploading}
              >
                {/* SVG instead of the × character because ×
                    (U+00D7) sits slightly above the visual center
                    of its line box — flex-centering can't
                    compensate. An SVG with a symmetric viewBox
                    centers cleanly. */}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              </button>
            </>
          ) : (
            <div
              aria-hidden="true"
              className="w-20 h-20 rounded-full bg-background-muted border border-charcoal-lighter/10 flex items-center justify-center text-2xl font-semibold text-charcoal-lighter"
            >
              {fallbackLetter?.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPicker}
            disabled={uploading}
          >
            {uploading
              ? t("avatarUploading")
              : value
              ? t("avatarChange")
              : t("avatarUpload")}
          </Button>
          <p className="text-xs text-charcoal-lighter">{t("avatarHelp")}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          // Reset so selecting the same file again still fires change.
          e.target.value = "";
        }}
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
