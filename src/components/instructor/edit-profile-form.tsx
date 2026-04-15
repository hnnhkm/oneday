"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateInstructorProfileAction,
  uploadIdDocumentAction,
} from "@/lib/actions/instructor";
import type { SocialLinks } from "@/lib/types/database";

const MAX_ID_DOC_BYTES = 10 * 1024 * 1024;

interface Props {
  initial: {
    bio: string;
    specialties: string[];
    social_links: SocialLinks;
    id_document_url: string | null;
  };
}

export function EditProfileForm({ initial }: Props) {
  const t = useTranslations("instructor.profile");
  const router = useRouter();
  const idFileInputRef = useRef<HTMLInputElement>(null);

  const [bio, setBio] = useState(initial.bio);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [specialties, setSpecialties] = useState<string[]>(initial.specialties);
  const [instagram, setInstagram] = useState(initial.social_links.instagram || "");
  const [website, setWebsite] = useState(initial.social_links.website || "");
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(
    initial.id_document_url
  );
  const [idUploading, setIdUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addSpecialty = () => {
    const v = specialtyInput.trim();
    if (!v) return;
    if (specialties.length >= 10) return;
    if (specialties.includes(v)) return;
    setSpecialties([...specialties, v]);
    setSpecialtyInput("");
  };
  const removeSpecialty = (s: string) =>
    setSpecialties(specialties.filter((x) => x !== s));

  const handleIdDocumentPick = async (file: File) => {
    setError(null);
    if (file.size > MAX_ID_DOC_BYTES) {
      setError(t("errorIdTooLarge"));
      return;
    }
    setIdUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadIdDocumentAction(fd);
      if (r.ok && r.url) setIdDocumentUrl(r.url);
      else setError(r.error || t("errorIdUpload"));
    } finally {
      setIdUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const result = await updateInstructorProfileAction({
      bio,
      specialties,
      social_links: {
        instagram: instagram || undefined,
        website: website || undefined,
      },
      id_document_url: idDocumentUrl,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || t("errorGeneric"));
      return;
    }
    setNotice(t("saved"));
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="bio"
          className="block text-sm font-medium text-charcoal mb-1.5"
        >
          {t("bioLabel")}
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={6}
          maxLength={1000}
          className="w-full rounded border border-charcoal-lighter/30 bg-white px-4 py-2.5 text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-charcoal-lighter">
          {t("bioHelp", { count: bio.length })}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          {t("specialtiesLabel")}
        </label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={specialtyInput}
            onChange={(e) => setSpecialtyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSpecialty();
              }
            }}
            placeholder={t("specialtiesPlaceholder")}
          />
          <Button type="button" variant="outline" onClick={addSpecialty}>
            +
          </Button>
        </div>
        {specialties.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 text-sm"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSpecialty(s)}
                  className="text-primary-400 hover:text-primary-600"
                  aria-label="remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Input
        id="instagram"
        label={t("instagramLabel")}
        type="text"
        value={instagram}
        onChange={(e) => setInstagram(e.target.value)}
        placeholder="@username"
      />
      <Input
        id="website"
        label={t("websiteLabel")}
        type="url"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="https://"
      />

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1.5">
          {t("idDocumentLabel")}
        </label>
        {idDocumentUrl ? (
          <div className="flex items-center gap-2 rounded-md bg-secondary-50 border border-secondary-200 px-3 py-2 text-sm">
            <span aria-hidden>📎</span>
            <a
              href={idDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 truncate text-secondary-700 hover:underline"
            >
              {t("idDocumentCurrent")}
            </a>
            <button
              type="button"
              onClick={() => idFileInputRef.current?.click()}
              disabled={idUploading}
              className="text-xs text-secondary-700 hover:underline"
            >
              {idUploading ? t("idDocumentUploading") : t("idDocumentReplace")}
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => idFileInputRef.current?.click()}
            disabled={idUploading}
          >
            {idUploading ? t("idDocumentUploading") : t("idDocumentUpload")}
          </Button>
        )}
        <input
          ref={idFileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleIdDocumentPick(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md bg-secondary-50 border border-secondary-200 text-secondary-700 px-3 py-2 text-sm">
          {notice}
        </div>
      )}

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
