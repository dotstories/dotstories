import { render, screen } from "@testing-library/react";
import Header from "../components/header";
import Footer from "../components/footer";

describe("Header", () => {
  it("links the logo to the homepage", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "DotStories" })).toHaveAttribute("href", "/");
  });
});

describe("Footer", () => {
  it("links to the open source code", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /source code on github/i })).toHaveAttribute(
      "href",
      "https://github.com/Dayonel/dotstories",
    );
  });
});
