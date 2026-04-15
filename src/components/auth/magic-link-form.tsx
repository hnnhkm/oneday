"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function MagicLinkForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <p className="text-secondary-300 font-medium">{t("magicLinkSent")}</p>
        <p className="text-sm text-charcoal-lighter mt-2">{t("checkEmail")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="magic-email"
        type="email"
        label={t("email")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="outline" disabled={loading} className="w-full">
        {loading ? "..." : t("magicLink")}
      </Button>
    </form>
  );
}
