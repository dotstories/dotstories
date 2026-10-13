import { render, screen } from "@testing-library/react";
import Home from "../app/page";

describe("Home", () => {
  it("shows the brand and tagline", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "DotStories" })).toBeInTheDocument();
    expect(screen.getByText("What is possible today with AI.")).toBeInTheDocument();
  });

  it("shows an example result made with a dot", () => {
    render(<Home />);
    expect(screen.getByRole("img", { name: /the weeping gate/i })).toBeInTheDocument();
  });
});
