import {
  isStripeEnabled,
  buildCheckoutLineItems,
} from "@/lib/stripe-config";

describe("isStripeEnabled", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it("returns false when the key is unset", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeEnabled()).toBe(false);
  });

  it("returns false when the key is the .env.example placeholder", () => {
    process.env.STRIPE_SECRET_KEY = "your_stripe_secret_key";
    expect(isStripeEnabled()).toBe(false);
  });

  it("returns false when the key is empty", () => {
    process.env.STRIPE_SECRET_KEY = "";
    expect(isStripeEnabled()).toBe(false);
  });

  it("returns true for a real-looking test key", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    expect(isStripeEnabled()).toBe(true);
  });
});

describe("buildCheckoutLineItems", () => {
  const baseActivity = {
    id: "act-1",
    title: { pt: "Aula de cerâmica", en: "Pottery class", es: "" },
    price_cents: 15000,
    cover_image_url: "https://cdn.example.com/cover.jpg",
    date: "2026-05-01",
    time: "14:00",
  };

  it("builds a BRL line item with seat quantity", () => {
    const items = buildCheckoutLineItems(baseActivity, 3, "pt");
    expect(items).toEqual([
      {
        price_data: {
          currency: "brl",
          product_data: {
            name: "Aula de cerâmica",
            description: "01/05/2026 · 14:00",
            images: ["https://cdn.example.com/cover.jpg"],
          },
          unit_amount: 15000,
        },
        quantity: 3,
      },
    ]);
  });

  it("falls back to pt when the requested locale is missing", () => {
    const items = buildCheckoutLineItems(baseActivity, 1, "es");
    expect(items[0].price_data.product_data.name).toBe("Aula de cerâmica");
  });

  it("uses the English title when the locale is en and available", () => {
    const items = buildCheckoutLineItems(baseActivity, 1, "en");
    expect(items[0].price_data.product_data.name).toBe("Pottery class");
  });

  it("omits the images array when cover_image_url is missing", () => {
    const items = buildCheckoutLineItems(
      { ...baseActivity, cover_image_url: "" },
      1,
      "pt"
    );
    expect(items[0].price_data.product_data.images).toBeUndefined();
  });
});
