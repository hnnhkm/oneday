import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("applies primary variant by default", () => {
    render(<Button>Primary</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary-400");
  });

  it("applies secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-secondary-300");
  });

  it("applies outline variant", () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-2");
  });

  it("renders disabled state", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders small size", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-3");
  });
});
