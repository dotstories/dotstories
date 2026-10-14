import { render, screen } from "@testing-library/react";
import Footer from "../components/footer";
import Header from "../components/header";

const mockSession: { current: unknown } = { current: null };
jest.mock("../auth", () => ({ auth: async () => mockSession.current, signOut: jest.fn() }));

describe("Header", () => {
  it("links the logo to the homepage", async () => {
    render(await Header());
    expect(screen.getByRole("link", { name: "DotStories" })).toHaveAttribute("href", "/");
  });

  it("logged out: Log in", async () => {
    mockSession.current = null;
    render(await Header());
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  it("logged in: username and Log out", async () => {
    mockSession.current = { user: { id: "1", username: "dayo" } };
    render(await Header());
    expect(screen.getByText("dayo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
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
