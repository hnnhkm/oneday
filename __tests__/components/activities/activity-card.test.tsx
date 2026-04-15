import { render, screen } from "@testing-library/react";

jest.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/lib/actions/account", () => ({
  toggleFavoriteAction: jest.fn(async () => ({ ok: true, favorited: true })),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

import { ActivityCard } from "@/components/activities/activity-card";

const mockActivity = {
  id: "test-123",
  title: { pt: "Aula de Culinária", en: "Cooking Class" },
  price_cents: 15000,
  date: "2026-04-20",
  time: "14:00",
  duration_minutes: 120,
  neighborhood: "Vila Madalena",
  city: "São Paulo",
  seats_remaining: 5,
  max_seats: 10,
  cover_image_url: "/test-image.jpg",
  status: "published" as const,
  instructor_profiles: {
    id: "inst-1",
    user_id: "user-1",
    users: { name: "Chef Maria", avatar_url: null },
  },
  categories: {
    name: { pt: "Culinária", en: "Cooking" },
    slug: "cooking",
    icon: "🍳",
  },
};

describe("ActivityCard", () => {
  it("renders activity title", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ActivityCard activity={mockActivity as any} locale="pt" />);
    expect(screen.getByText("Aula de Culinária")).toBeInTheDocument();
  });

  it("does not render the instructor name on the card", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ActivityCard activity={mockActivity as any} locale="pt" />);
    expect(screen.queryByText("Chef Maria")).not.toBeInTheDocument();
  });

  it("renders neighborhood", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ActivityCard activity={mockActivity as any} locale="pt" />);
    expect(screen.getByText(/Vila Madalena/)).toBeInTheDocument();
  });

  it("renders category badge", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ActivityCard activity={mockActivity as any} locale="pt" />);
    expect(screen.getByText(/🍳 Culinária/)).toBeInTheDocument();
  });

  it("renders seats remaining", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ActivityCard activity={mockActivity as any} locale="pt" />);
    expect(screen.getByText(/5 vagas/)).toBeInTheDocument();
  });
});
