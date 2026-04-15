"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoginMethod = "email" | "whatsapp";

export function UnifiedLoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>("email");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (!codeSent) {
      // Step 1: Send code
      if (method === "whatsapp") {
        const { error } = await supabase.auth.signInWithOtp({
          phone: value,
          options: { channel: "whatsapp" },
        });
        if (error) { setError(t("errorSendCode")); setLoading(false); return; }
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: value,
        });
        if (error) { setError(t("errorSendCode")); setLoading(false); return; }
      }
      setCodeSent(true);
      setLoading(false);
      return;
    }

    // Step 2: Verify code
    const verifyPayload = method === "whatsapp"
      ? { phone: value, token: code, type: "sms" as const }
      : { email: value, token: code, type: "email" as const };

    const { error: verifyErr } = await supabase.auth.verifyOtp(verifyPayload);
    if (verifyErr) {
      setError(t("errorInvalidCode"));
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  function switchMethod(m: LoginMethod) {
    setMethod(m);
    setValue("");
    setCode("");
    setCodeSent(false);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Segmented toggle */}
      <div>
        <label className="block text-xs font-medium text-charcoal-lighter mb-1.5">
          {t("loginMethod")}
        </label>
        <div className="flex rounded-lg border border-charcoal-lighter/20 overflow-hidden">
          <button
            type="button"
            onClick={() => switchMethod("email")}
            className={cn(
              "flex-1 py-2 text-sm font-medium transition-colors",
              method === "email"
                ? "bg-primary-400 text-white"
                : "bg-white text-charcoal hover:bg-background-muted"
            )}
          >
            {t("email")}
          </button>
          <button
            type="button"
            onClick={() => switchMethod("whatsapp")}
            className={cn(
              "flex-1 py-2 text-sm font-medium transition-colors border-l border-charcoal-lighter/20",
              method === "whatsapp"
                ? "bg-primary-400 text-white"
                : "bg-white text-charcoal hover:bg-background-muted"
            )}
          >
            WhatsApp
          </button>
        </div>
      </div>

      {/* Input field */}
      {method === "email" ? (
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          autoComplete="email"
          disabled={codeSent}
        />
      ) : (
        <Input
          id="phone"
          type="tel"
          placeholder="+55 11 99999-9999"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          autoComplete="tel"
          disabled={codeSent}
        />
      )}

      {/* Code input — shown after sending */}
      {codeSent && (
        <>
          <p className="text-sm text-secondary-500 font-medium">
            {t(method === "email" ? "codeSentEmail" : "codeSentWhatsapp")}
          </p>
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
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "..." : codeSent ? t("verifyCode") : t("sendCode")}
      </Button>

      {codeSent && (
        <button
          type="button"
          onClick={() => { setCodeSent(false); setCode(""); setError(null); }}
          className="text-sm text-charcoal-lighter hover:text-charcoal text-center"
        >
          {t("changeMethod")}
        </button>
      )}
    </form>
  );
}
