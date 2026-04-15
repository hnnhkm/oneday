"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resizeImage } from "@/lib/image-resize";
import { uploadActivityImageAction } from "@/lib/actions/instructor";

interface CoverProps {
  value: string;
  onChange: (url: string) => void;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function CoverImageUploader({ value, onChange }: CoverProps) {
  const t = useTranslations("instructor.form");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("fileTooLarge"));
      return;
    }
    setUploading(true);
    try {
      const blob = await resizeImage(file);
      const fd = new FormData();
      fd.append("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      const res = await uploadActivityImageAction(fd);
      if (res.ok && res.url) onChange(res.url);
      else setError(res.error || t("errorUpload"));
    } catch {
      setError(t("errorUpload"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="rounded-lg max-h-60 object-cover"
          />
          <button
            type="button"
            className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center shadow"
            onClick={() => onChange("")}
            aria-label={t("remove")}
          >
            ×
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? t("uploading") : t("coverUpload")}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

interface GalleryProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

export function GalleryImageUploader({ value, onChange }: GalleryProps) {
  const t = useTranslations("instructor.form");
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadOne = async (file: File): Promise<string | null> => {
    if (file.size > MAX_BYTES) {
      setError(t("fileTooLarge"));
      return null;
    }
    const blob = await resizeImage(file);
    const fd = new FormData();
    fd.append("file", new File([blob], "gallery.jpg", { type: "image/jpeg" }));
    const res = await uploadActivityImageAction(fd);
    if (res.ok && res.url) return res.url;
    setError(res.error || t("errorUpload"));
    return null;
  };

  const handleAdd = async (file: File) => {
    setError(null);
    if (value.length >= 10) return;
    setUploading(true);
    try {
      const url = await uploadOne(file);
      if (url) onChange([...value, url]);
    } catch {
      setError(t("errorUpload"));
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (file: File) => {
    setError(null);
    const idx = replaceIndex;
    setReplaceIndex(null);
    if (idx == null) return;
    setUploading(true);
    try {
      const url = await uploadOne(file);
      if (url) {
        const next = [...value];
        next[idx] = url;
        onChange(next);
      }
    } catch {
      setError(t("errorUpload"));
    } finally {
      setUploading(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => (
          <div key={url + i} className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="w-32 h-32 object-cover rounded"
            />
            <button
              type="button"
              className="absolute top-1 right-1 bg-white/90 hover:bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-sm"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={t("remove")}
              disabled={uploading}
            >
              ×
            </button>
            <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  className="bg-white/90 hover:bg-white rounded w-6 h-6 flex items-center justify-center shadow text-xs disabled:opacity-30"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0 || uploading}
                  aria-label={t("galleryMoveLeft")}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="bg-white/90 hover:bg-white rounded w-6 h-6 flex items-center justify-center shadow text-xs disabled:opacity-30"
                  onClick={() => move(i, i + 1)}
                  disabled={i === value.length - 1 || uploading}
                  aria-label={t("galleryMoveRight")}
                >
                  →
                </button>
              </div>
              <button
                type="button"
                className="bg-white/90 hover:bg-white rounded px-1.5 h-6 flex items-center justify-center shadow text-xs"
                onClick={() => {
                  setReplaceIndex(i);
                  replaceInputRef.current?.click();
                }}
                disabled={uploading}
                aria-label={t("galleryReplace")}
              >
                {t("galleryReplace")}
              </button>
            </div>
          </div>
        ))}
        {value.length < 10 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => addInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? t("uploading") : t("galleryUpload")}
          </Button>
        )}
      </div>
      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAdd(f);
          e.target.value = "";
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleReplace(f);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
