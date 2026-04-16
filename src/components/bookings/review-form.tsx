"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  submitReviewAction,
  updateReviewAction,
  uploadReviewPhotoAction,
  deleteReviewPhotoAction,
} from "@/lib/actions/bookings";
import { resizeImage } from "@/lib/image-resize";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

interface ReviewFormProps {
  activityId: string;
  /**
   * When present, the form renders in edit mode: rating/comment are
   * pre-filled, existing photos are shown with delete buttons, and
   * submit calls `updateReviewAction` instead of `submitReviewAction`.
   * When absent, the form is a fresh "write a review" screen.
   */
  existing?: {
    reviewId: string;
    rating: number;
    comment: string;
    photos: { id: string; image_url: string }[];
  };
}

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

/**
 * Existing (already-uploaded) photo displayed alongside pending
 * (not-yet-uploaded) photos. `id` is the DB row id we'll target
 * when the user removes it.
 */
interface ExistingPhoto {
  id: string;
  imageUrl: string;
  /**
   * Flips to true after the user clicks remove and the delete
   * action succeeds. We keep the item in state for one render tick
   * so React can animate it out, but we filter it out of the
   * visible list immediately. Kept simple — we just drop it from
   * state on success.
   */
}

export function ReviewForm({ activityId, existing }: ReviewFormProps) {
  const t = useTranslations("review");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(existing);

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(
    existing?.photos.map((p) => ({ id: p.id, imageUrl: p.image_url })) ?? []
  );
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalPhotoCount = existingPhotos.length + photos.length;

  function addPhoto(file: File) {
    setError(null);
    if (totalPhotoCount >= MAX_PHOTOS) return;
    if (file.size > MAX_BYTES) {
      setError(t("errorFileTooLarge"));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPhotos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), file, previewUrl },
    ]);
  }

  function removePendingPhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function removeExistingPhoto(photoId: string) {
    // Optimistic: drop from the visible list immediately, rollback
    // on failure. This feels snappy and matches how the rest of the
    // app handles single-item deletes.
    const snapshot = existingPhotos;
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
    const res = await deleteReviewPhotoAction(photoId);
    if (!res.ok) {
      setExistingPhotos(snapshot);
      setError(res.error || t("errorGeneric"));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError(t("ratingLabel"));
      return;
    }
    startTransition(async () => {
      // In edit mode we already have a review id; in create mode we
      // get one back from the insert. Both paths converge on the
      // same reviewId before we upload any new photos.
      let reviewId: string;
      if (isEdit && existing) {
        const result = await updateReviewAction(
          existing.reviewId,
          rating,
          comment
        );
        if (!result.ok) {
          setError(result.error || t("errorGeneric"));
          return;
        }
        reviewId = existing.reviewId;
      } else {
        const result = await submitReviewAction(activityId, rating, comment);
        if (!result.ok || !result.reviewId) {
          setError(result.error || t("errorGeneric"));
          return;
        }
        reviewId = result.reviewId;
      }

      // Upload any newly added photos. Sequential so partial failure
      // doesn't scatter stray blobs in storage. Best-effort: we
      // still report success even if a single photo upload fails.
      for (const photo of photos) {
        try {
          const blob = await resizeImage(photo.file);
          const fd = new FormData();
          fd.append(
            "file",
            new File([blob], "review.jpg", { type: "image/jpeg" })
          );
          const r = await uploadReviewPhotoAction(reviewId, fd);
          if (!r.ok) {
            console.warn("[review:photo-upload] failed:", r.error);
          }
        } catch (err) {
          console.warn("[review:photo-upload] exception:", err);
        }
      }

      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setSuccess(true);
      router.refresh();
    });
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">⭐</div>
        <h2 className="text-xl font-semibold text-charcoal mb-2">
          {isEdit ? t("successEditTitle") : t("successTitle")}
        </h2>
        <p className="text-charcoal-lighter mb-6">
          {isEdit ? t("successEditSubtitle") : t("successSubtitle")}
        </p>
        <Button onClick={() => router.push("/bookings?tab=past" as "/bookings")}>
          {t("backToBookings")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          {t("ratingLabel")}
        </label>
        <div
          className="flex gap-1"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = (hoverRating || rating) >= star;
            return (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                className={cn(
                  "text-3xl transition-colors leading-none",
                  filled ? "text-accent-400" : "text-charcoal-lighter/30"
                )}
              >
                ★
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="review-comment"
          className="block text-sm font-medium text-charcoal mb-2"
        >
          {t("commentLabel")}
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("commentPlaceholder")}
          rows={5}
          maxLength={2000}
          className="w-full rounded-md border border-charcoal-lighter/20 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          {t("photosLabel")}
        </label>
        <div className="flex flex-wrap gap-3">
          {/* Existing (already-uploaded) photos first, so the
              ordering is stable across saves. */}
          {existingPhotos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt=""
                className="w-24 h-24 object-cover rounded"
              />
              <button
                type="button"
                onClick={() => removeExistingPhoto(p.id)}
                aria-label={t("photosRemove")}
                className="absolute top-1 right-1 bg-white/90 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-sm"
                disabled={isPending}
              >
                ×
              </button>
            </div>
          ))}
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt=""
                className="w-24 h-24 object-cover rounded"
              />
              <button
                type="button"
                onClick={() => removePendingPhoto(p.id)}
                aria-label={t("photosRemove")}
                className="absolute top-1 right-1 bg-white/90 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-sm"
              >
                ×
              </button>
            </div>
          ))}
          {totalPhotoCount < MAX_PHOTOS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              + {t("photosAdd")}
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-charcoal-lighter">
          {t("photosHelp", { max: MAX_PHOTOS })}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addPhoto(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        disabled={isPending || rating < 1}
        className="self-start"
      >
        {isPending
          ? t("submitting")
          : isEdit
          ? t("saveChanges")
          : t("submit")}
      </Button>
    </form>
  );
}
