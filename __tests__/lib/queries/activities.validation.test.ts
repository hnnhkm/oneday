import {
  validateActivityInput,
  type ActivityInput,
} from "@/lib/queries/activities";

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) =>
  new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

function validBase(): ActivityInput {
  return {
    title: { pt: "Aula de cerâmica", en: "Pottery class", es: "" },
    description: { pt: "Descrição válida", en: "", es: "" },
    category_id: "10000000-0000-0000-0000-000000000001",
    tags: ["beginner-friendly"],
    price_cents: 15000,
    date: inDays(7),
    time: "14:00",
    duration_minutes: 120,
    address: "Rua Harmonia, 350",
    neighborhood: "Vila Madalena",
    city: "São Paulo",
    state: "SP",
    max_seats: 10,
    min_participants: 0,
    cover_image_url: "https://cdn.example.com/cover.jpg",
    gallery_image_urls: [],
    cancellation_policy: "flexible",
    cancellation_policy_text: null,
    no_show_fee_cents: null,
  };
}

describe("validateActivityInput", () => {
  it("accepts a minimal valid input", () => {
    expect(validateActivityInput(validBase())).toBeNull();
  });

  it("requires title.pt", () => {
    const input = validBase();
    input.title.pt = "   ";
    expect(validateActivityInput(input)?.field).toBe("title");
  });

  it("treats empty title.en/es as optional (fallback to pt)", () => {
    const input = validBase();
    input.title.en = "";
    input.title.es = "";
    expect(validateActivityInput(input)).toBeNull();
  });

  it("requires description.pt", () => {
    const input = validBase();
    input.description.pt = "";
    expect(validateActivityInput(input)?.field).toBe("description");
  });

  it("requires category_id", () => {
    const input = validBase();
    input.category_id = "";
    expect(validateActivityInput(input)?.field).toBe("category_id");
  });

  it("rejects price below R$ 5,00", () => {
    const input = validBase();
    input.price_cents = 499;
    expect(validateActivityInput(input)?.field).toBe("price_cents");
  });

  it("rejects price above R$ 10.000", () => {
    const input = validBase();
    input.price_cents = 1_000_001;
    expect(validateActivityInput(input)?.field).toBe("price_cents");
  });

  it("accepts price at the boundaries", () => {
    const low = validBase();
    low.price_cents = 500;
    expect(validateActivityInput(low)).toBeNull();
    const high = validBase();
    high.price_cents = 1_000_000;
    expect(validateActivityInput(high)).toBeNull();
  });

  it("rejects max_seats outside 1..50", () => {
    const zero = validBase();
    zero.max_seats = 0;
    expect(validateActivityInput(zero)?.field).toBe("max_seats");
    const big = validBase();
    big.max_seats = 51;
    expect(validateActivityInput(big)?.field).toBe("max_seats");
  });

  it("rejects duration outside 30..480 minutes", () => {
    const short = validBase();
    short.duration_minutes = 15;
    expect(validateActivityInput(short)?.field).toBe("duration_minutes");
    const long = validBase();
    long.duration_minutes = 481;
    expect(validateActivityInput(long)?.field).toBe("duration_minutes");
  });

  it("rejects duration that isn't a half-hour increment", () => {
    const off = validBase();
    off.duration_minutes = 75; // 1h15m — not allowed
    expect(validateActivityInput(off)?.field).toBe("duration_minutes");
  });

  it("rejects dates in the past", () => {
    const input = validBase();
    input.date = inDays(-1);
    expect(validateActivityInput(input)?.field).toBe("date");
  });

  it("accepts today's date", () => {
    const input = validBase();
    input.date = today();
    expect(validateActivityInput(input)).toBeNull();
  });

  it("rejects malformed time", () => {
    const input = validBase();
    input.time = "25:00";
    expect(validateActivityInput(input)?.field).toBe("time");
    input.time = "14h";
    expect(validateActivityInput(input)?.field).toBe("time");
  });

  it("accepts HH:MM time", () => {
    const input = validBase();
    input.time = "09:30";
    expect(validateActivityInput(input)).toBeNull();
    input.time = "23:59";
    expect(validateActivityInput(input)).toBeNull();
  });

  it("requires address, city, state", () => {
    const noAddr = validBase();
    noAddr.address = "  ";
    expect(validateActivityInput(noAddr)?.field).toBe("address");
    const noCity = validBase();
    noCity.city = "";
    expect(validateActivityInput(noCity)?.field).toBe("city");
    const noState = validBase();
    noState.state = "";
    expect(validateActivityInput(noState)?.field).toBe("state");
  });

  it("requires cover_image_url", () => {
    const input = validBase();
    input.cover_image_url = "";
    expect(validateActivityInput(input)?.field).toBe("cover_image_url");
  });

  it("rejects more than 10 gallery images", () => {
    const input = validBase();
    input.gallery_image_urls = new Array(11).fill("https://x/y.jpg");
    expect(validateActivityInput(input)?.field).toBe("gallery_image_urls");
  });

  it("accepts exactly 10 gallery images", () => {
    const input = validBase();
    input.gallery_image_urls = new Array(10).fill("https://x/y.jpg");
    expect(validateActivityInput(input)).toBeNull();
  });

  it("rejects invalid cancellation_policy", () => {
    const input = validBase();
    // @ts-expect-error - testing runtime validation
    input.cancellation_policy = "nonsense";
    expect(validateActivityInput(input)?.field).toBe("cancellation_policy");
  });
});
