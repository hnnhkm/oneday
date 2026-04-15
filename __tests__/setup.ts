import "@testing-library/jest-dom";
// jsdom doesn't polyfill TextEncoder/TextDecoder but React 18's
// react-dom/server.browser.js needs them. Pull from Node's util.
import { TextEncoder, TextDecoder } from "util";
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder =
    TextDecoder;
}

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "pt",
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => "/pt",
  useSearchParams: () => new URLSearchParams(),
}));
