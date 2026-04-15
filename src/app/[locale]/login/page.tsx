import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { UnifiedLoginForm } from "@/components/auth/unified-login-form";

export default function LoginPage() {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-[80vh] items-start justify-center px-4 pt-12 md:pt-20">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">{t("loginTitle")}</h1>

        <SocialLoginButtons />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-charcoal-lighter/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-4 text-charcoal-lighter">
              {t("orContinueWith")}
            </span>
          </div>
        </div>

        <UnifiedLoginForm />

        <p className="text-center text-sm text-charcoal-lighter">
          {t("noAccount")}{" "}
          <Link href="/signup" className="text-primary-400 font-medium hover:underline">
            {t("signupButton")}
          </Link>
        </p>
      </div>
    </div>
  );
}
