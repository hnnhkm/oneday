"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function WhatsAppOtpForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: "whatsapp",
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setCodeSent(true);
    setLoading(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (!codeSent) {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <Input
          id="phone"
          type="tel"
          label={t("enterPhone")}
          placeholder="+55 11 99999-9999"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoComplete="tel"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="outline" disabled={loading} className="w-full gap-2">
          {loading ? "..." : t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="flex flex-col gap-4">
      <p className="text-sm text-secondary-300 font-medium">{t("codeSentWhatsapp")}</p>
      <Input
        id="otp-code"
        type="text"
        label={t("enterCode")}
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        maxLength={6}
        pattern="[0-9]{6}"
        autoComplete="one-time-code"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "..." : t("verifyCode")}
      </Button>
    </form>
  );
}
