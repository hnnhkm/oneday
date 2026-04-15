import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt", "en", "es"],
  defaultLocale: "pt",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
