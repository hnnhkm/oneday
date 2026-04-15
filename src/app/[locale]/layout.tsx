import { Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Footer } from "@/components/layout/footer";
import { getUser } from "@/lib/supabase/get-user";
import { fetchInstructorProfileByUserId } from "@/lib/queries/instructor";
import type { Metadata } from "next";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "oneday",
  description: "Discover and book one-day hobby activities near you",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Tell next-intl which locale this request is for. Without this,
  // getLocale() / useLocale() fall back to the default locale (pt)
  // on the server even when the URL prefix is /en or /es, which
  // causes every server-rendered <Link> to point at /pt/*.
  setRequestLocale(locale);

  const messages = await getMessages();

  // Resolve instructor status for the mobile bottom nav. Header
  // makes the same calls internally — Next.js request-level
  // deduplication ensures a single DB round-trip per request.
  const user = await getUser();
  const instructorProfile = user
    ? await fetchInstructorProfileByUserId(user.id)
    : null;
  const isApprovedInstructor =
    !!instructorProfile && instructorProfile.approval_status === "approved";

  return (
    <html lang={locale} className={`${jakarta.variable} overflow-x-clip`}>
      {/* `overflow-x-clip` (NOT `overflow-x-hidden`) on both <html>
          and <body> prevents horizontal page scroll without breaking
          `position: sticky` on the header. Per CSS spec, setting
          `overflow-x: hidden` forces `overflow-y: auto` on the same
          element — which makes body a scroll container and detaches
          sticky children from viewport scroll. `overflow: clip` was
          designed for exactly this case: it clips the axis without
          creating a scroll container, so the sticky header keeps
          working on mobile. Vertical page scroll unaffected. */}
      <body className="bg-background text-charcoal font-sans antialiased overflow-x-clip">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <MobileNav isApprovedInstructor={isApprovedInstructor} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
