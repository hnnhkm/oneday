import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";

export default function SignupPage() {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">{t("signupTitle")}</h1>

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

        <SignupForm />

        <p className="text-center text-sm text-charcoal-lighter">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-primary-400 font-medium hover:underline">
            {t("loginButton")}
          </Link>
        </p>
      </div>
    </div>
  );
}
