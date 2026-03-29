import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoryFilter from "../CategoryFilter";

describe("CategoryFilter", () => {
  const categories = ["Tümü", "Spor", "Ekonomi"];

  it("renders all category buttons", () => {
    render(
      <CategoryFilter
        categories={categories}
        activeCategory="Tümü"
        onCategoryChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /Tümü/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Spor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ekonomi/i })).toBeInTheDocument();
  });

  it("calls onCategoryChange when a category is clicked", async () => {
    const user = userEvent.setup();
    const onCategoryChange = jest.fn();

    render(
      <CategoryFilter
        categories={categories}
        activeCategory="Tümü"
        onCategoryChange={onCategoryChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Spor/i }));
    expect(onCategoryChange).toHaveBeenCalledWith("Spor");
  });

  it("highlights active category with active style class", () => {
    render(
      <CategoryFilter
        categories={categories}
        activeCategory="Ekonomi"
        onCategoryChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /Ekonomi/i })).toHaveClass("bg-[var(--accent-primary)]");
  });

  it("renders fallback icon for unknown category", () => {
    render(
      <CategoryFilter
        categories={["Bilinmeyen"]}
        activeCategory="Bilinmeyen"
        onCategoryChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /Bilinmeyen/i })).toHaveTextContent("📄");
  });
});
