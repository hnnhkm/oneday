/**
 * Client-side canvas-based image resize. Called before uploading to the
 * `activity-images` Supabase Storage bucket so we never push originals
 * over the wire — a phone photo is typically 4–6MB, the resized output
 * is usually 200–400KB.
 *
 * Caller guarantees this runs in the browser (form components mark
 * themselves `"use client"`). We bail out gracefully if the browser
 * can't decode the file.
 */
export interface ResizeOptions {
  maxWidth?: number;
  quality?: number; // 0..1
  mimeType?: string;
}

const DEFAULTS: Required<ResizeOptions> = {
  maxWidth: 1600,
  quality: 0.85,
  mimeType: "image/jpeg",
};

export async function resizeImage(
  file: File,
  options: ResizeOptions = {}
): Promise<Blob> {
  const { maxWidth, quality, mimeType } = { ...DEFAULTS, ...options };

  const bitmap = await createImageBitmapCompat(file);
  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const targetW = Math.round(bitmap.width * scale);
  const targetH = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2D context");
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, quality)
  );
  if (!blob) throw new Error("Canvas toBlob returned null");
  return blob;
}

async function createImageBitmapCompat(file: File): Promise<ImageBitmap> {
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    return createImageBitmap(file);
  }
  throw new Error("createImageBitmap is not available in this environment");
}
