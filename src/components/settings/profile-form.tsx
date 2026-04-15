"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfileAction } from "@/lib/actions/account";
import type { PreferredLanguage, User } from "@/lib/types/database";

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "");
  const [language, setLanguage] = useState<PreferredLanguage>(
    user.preferred_language
  );
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await updateProfileAction({
        name,
        phone: phone.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        preferred_language: language,
      });

      if (result.ok) {
        setMessage({ kind: "success", text: t("saveSuccess") });
        router.refresh();
      } else {
        setMessage({
          kind: "error",
          text: result.error || t("saveError"),
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section>
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          {t("profileSection")}
        </h2>
        <div className="flex flex-col gap-4">
          <div>
            <Input
              id="settings-email"
              label={t("emailLabel")}
              value={user.email}
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-charcoal-lighter">{t("emailHelp")}</p>
          </div>
          <Input
            id="settings-name"
            label={t("nameLabel")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
          />
          <Input
            id="settings-phone"
            type="tel"
            label={t("phoneLabel")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 11 98765-4321"
          />
          <div>
            <Input
              id="settings-avatar"
              type="url"
              label={t("avatarLabel")}
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="mt-1 text-xs text-charcoal-lighter">{t("avatarHelp")}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          {t("preferencesSection")}
        </h2>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="settings-language"
            className="text-sm font-medium text-charcoal"
          >
            {t("preferredLanguageLabel")}
          </label>
          <select
            id="settings-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as PreferredLanguage)}
            className="rounded-md border border-charcoal-lighter/20 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
      </section>

      {message && (
        <p
          className={`text-sm ${
            message.kind === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
