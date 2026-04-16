"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarUploader } from "./avatar-uploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfileAction } from "@/lib/actions/account";
import type { PreferredLanguage, User } from "@/lib/types/database";

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
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
        // If the user switched their preferred language, re-route to
        // the same page under the new locale so the whole UI
        // re-renders in that language immediately. `router.refresh()`
        // alone only re-fetches server data on the current locale —
        // it won't swap translations. When the language didn't
        // change, a plain refresh is enough.
        if (language !== user.preferred_language) {
          router.replace(pathname, { locale: language });
        } else {
          router.refresh();
        }
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
            <label className="block text-sm font-medium text-charcoal mb-2">
              {t("avatarLabel")}
            </label>
            <AvatarUploader
              value={avatarUrl}
              onChange={setAvatarUrl}
              fallbackLetter={name || user.name || user.email}
            />
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
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as PreferredLanguage)}
          >
            <SelectTrigger id="settings-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt">Português</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
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
