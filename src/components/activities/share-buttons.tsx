"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ShareButtonsProps {
  title: string;
  shareText: string;
  url: string;
}

/**
 * Icon-only share row. Brand marks are inline SVGs rather than an icon-font
 * dep — they render crisp at any size and let each brand keep its own color
 * on hover without tinting via CSS tricks.
 */
export function ShareButtons({ title, shareText, url }: ShareButtonsProps) {
  const t = useTranslations("activities");
  const [igCopied, setIgCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const whatsappHref = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
  const telegramHref = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const emailHref = `mailto:?subject=${encodedTitle}&body=${encodedText}%20${encodedUrl}`;

  async function copyForInstagram() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setIgCopied(true);
      setTimeout(() => setIgCopied(false), 2500);
    } catch {
      // Clipboard blocked — silently no-op
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // Clipboard blocked — silently no-op
    }
  }

  return (
    <div className="border-t border-charcoal-lighter/10 pt-4">
      <p className="text-xs font-medium text-charcoal mb-2">
        {t("shareTitle")}
      </p>
      <div className="flex items-center gap-2">
        <ShareIconLink
          href={whatsappHref}
          label={t("shareWhatsApp")}
          hoverClass="hover:bg-[#25D366]/10 hover:text-[#25D366]"
        >
          <WhatsAppIcon />
        </ShareIconLink>
        <ShareIconLink
          href={telegramHref}
          label={t("shareTelegram")}
          hoverClass="hover:bg-[#229ED9]/10 hover:text-[#229ED9]"
        >
          <TelegramIcon />
        </ShareIconLink>
        <ShareIconButton
          label={igCopied ? t("instagramCopied") : t("shareInstagram")}
          active={igCopied}
          hoverClass="hover:bg-[#E1306C]/10 hover:text-[#E1306C]"
          onClick={copyForInstagram}
        >
          <InstagramIcon />
        </ShareIconButton>
        <ShareIconLink
          href={emailHref}
          label={t("shareEmail")}
          hoverClass="hover:bg-charcoal/10 hover:text-charcoal"
        >
          <EmailIcon />
        </ShareIconLink>
        <ShareIconButton
          label={linkCopied ? t("linkCopied") : t("copyLink")}
          active={linkCopied}
          hoverClass="hover:bg-primary-400/10 hover:text-primary-400"
          onClick={copyLink}
        >
          <LinkIcon />
        </ShareIconButton>
      </div>
    </div>
  );
}

/**
 * Shared button chrome: 40px square, rounded, border, centered icon,
 * flex-1 so all five buttons divide the available row equally. `active`
 * swaps in a "just copied" visual state so the user gets feedback even
 * though the label itself is only visible as a tooltip.
 */
function ShareIconButton({
  label,
  active = false,
  hoverClass,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  hoverClass: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex-1 h-10 rounded-lg border flex items-center justify-center transition-colors",
        active
          ? "border-primary-400 bg-primary-400/10 text-primary-400"
          : cn("border-charcoal-lighter/20 text-charcoal-lighter", hoverClass)
      )}
    >
      {children}
    </button>
  );
}

function ShareIconLink({
  href,
  label,
  hoverClass,
  children,
}: {
  href: string;
  label: string;
  hoverClass: string;
  children: React.ReactNode;
}) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      aria-label={label}
      title={label}
      className={cn(
        "flex-1 h-10 rounded-lg border border-charcoal-lighter/20 text-charcoal-lighter flex items-center justify-center transition-colors",
        hoverClass
      )}
    >
      {children}
    </a>
  );
}

// --- Brand marks --------------------------------------------------------
// Inline SVGs using `currentColor` so the button's text color (which
// flips on hover/active) drives the fill. 18px viewBox size keeps them
// comfortable inside the 40px button.

function WhatsAppIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 22.0a10.0 10.0 0 0 1-5.096-1.396l-.366-.217-3.79.994 1.011-3.693-.238-.378A9.94 9.94 0 0 1 2.05 12c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10zm8.413-18.412A11.95 11.95 0 0 0 12.05 0C5.495 0 .138 5.336.136 11.89c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.89 11.89 0 0 0 5.745 1.463h.005c6.554 0 11.91-5.336 11.913-11.89a11.83 11.83 0 0 0-3.505-8.332z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
