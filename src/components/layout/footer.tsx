import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-charcoal-lighter/10 bg-white py-8 pb-24 md:pb-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-charcoal-lighter">
            <span>© {new Date().getFullYear()}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="oneday" className="h-5 opacity-60" />
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-xs text-charcoal-lighter hover:text-charcoal transition-colors"
            >
              {t("about")}
            </Link>
            <Link
              href="/"
              className="text-xs text-charcoal-lighter hover:text-charcoal transition-colors"
            >
              {t("help")}
            </Link>
            <Link
              href="/"
              className="text-xs text-charcoal-lighter hover:text-charcoal transition-colors"
            >
              {t("terms")}
            </Link>
            <Link
              href="/"
              className="text-xs text-charcoal-lighter hover:text-charcoal transition-colors"
            >
              {t("privacy")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
