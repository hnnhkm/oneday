import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders with text", () => {
    render(<Badge>Cooking</Badge>);
    expect(screen.getByText("Cooking")).toBeInTheDocument();
  });

  it("applies default variant", () => {
    render(<Badge>Tag</Badge>);
    expect(screen.getByText("Tag")).toHaveClass("bg-primary-50");
  });

  it("applies accent variant", () => {
    render(<Badge variant="accent">Hot</Badge>);
    expect(screen.getByText("Hot")).toHaveClass("bg-accent-50");
  });
});
