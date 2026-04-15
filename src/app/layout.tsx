/**
 * Root layout — required by Next.js when a root not-found.tsx
 * exists. The real layout (with i18n, fonts, header, footer)
 * lives in [locale]/layout.tsx. This just provides the minimal
 * html + body shell for the root 404 page.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
