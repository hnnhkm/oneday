import { validateProfileUpdate } from "@/lib/queries/profile";

describe("validateProfileUpdate", () => {
  const validBase = {
    name: "Ana Souza",
    phone: null,
    avatar_url: null,
    preferred_language: "pt" as const,
  };

  it("accepts a minimal valid update", () => {
    expect(validateProfileUpdate(validBase)).toBeNull();
  });

  it("rejects names shorter than 2 characters", () => {
    expect(validateProfileUpdate({ ...validBase, name: "A" })?.field).toBe(
      "name"
    );
    expect(validateProfileUpdate({ ...validBase, name: "" })?.field).toBe("name");
    expect(validateProfileUpdate({ ...validBase, name: "  " })?.field).toBe(
      "name"
    );
  });

  it("rejects names longer than 100 characters", () => {
    const longName = "x".repeat(101);
    expect(validateProfileUpdate({ ...validBase, name: longName })?.field).toBe(
      "name"
    );
  });

  it("accepts valid Brazilian phone formats", () => {
    expect(
      validateProfileUpdate({ ...validBase, phone: "+55 11 98765-4321" })
    ).toBeNull();
    expect(
      validateProfileUpdate({ ...validBase, phone: "(11) 98765-4321" })
    ).toBeNull();
    expect(validateProfileUpdate({ ...validBase, phone: "11987654321" })).toBeNull();
  });

  it("rejects phone with letters", () => {
    expect(
      validateProfileUpdate({ ...validBase, phone: "abc-defg" })?.field
    ).toBe("phone");
  });

  it("rejects phone with too few digits", () => {
    expect(validateProfileUpdate({ ...validBase, phone: "123" })?.field).toBe(
      "phone"
    );
  });

  it("accepts valid https avatar URLs", () => {
    expect(
      validateProfileUpdate({
        ...validBase,
        avatar_url: "https://example.com/me.jpg",
      })
    ).toBeNull();
  });

  it("rejects non-http(s) avatar URLs", () => {
    expect(
      validateProfileUpdate({
        ...validBase,
        avatar_url: "ftp://example.com/me.jpg",
      })?.field
    ).toBe("avatar_url");
  });

  it("rejects malformed avatar URLs", () => {
    expect(
      validateProfileUpdate({ ...validBase, avatar_url: "not a url" })?.field
    ).toBe("avatar_url");
  });

  it("accepts null phone and avatar_url", () => {
    expect(
      validateProfileUpdate({ ...validBase, phone: null, avatar_url: null })
    ).toBeNull();
  });

  it("rejects invalid preferred language", () => {
    expect(
      validateProfileUpdate({
        ...validBase,
        // @ts-expect-error - testing runtime validation
        preferred_language: "fr",
      })?.field
    ).toBe("preferred_language");
  });
});
