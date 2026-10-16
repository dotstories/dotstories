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

  it("links to the community on GitHub", async () => {
    render(await Header());
    const link = screen.getByRole("link", { name: /DotStories on GitHub/ });
    expect(link).toHaveAttribute("href", "https://github.com/Dayonel/dotstories");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("logged in: username and Log out", async () => {
    mockSession.current = { user: { id: "1", username: "dayo" } };
    render(await Header());
    expect(screen.getByText("dayo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("invites people to the community on GitHub", () => {
    render(<Footer />);
    expect(screen.getByText(/open source and made by its community/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /source code on github/i })).toHaveAttribute("href", "https://github.com/Dayonel/dotstories");
    expect(screen.getByRole("link", { name: "Contribute on GitHub" })).toHaveAttribute("href", "https://github.com/Dayonel/dotstories");
  });

  it("is about the project, not one person: no personal socials", () => {
    render(<Footer />);
    expect(screen.queryByRole("link", { name: /on X/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /on LinkedIn/ })).not.toBeInTheDocument();
  });

  it("contact, blog and legal pages", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "info@dotstories.com" })).toHaveAttribute("href", "mailto:info@dotstories.com");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "https://blog.dotstories.com/");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Cookies" })).toHaveAttribute("href", "/cookies");
  });

  it("shows who runs the site", () => {
    render(<Footer />);
    expect(screen.getByText(/^© \d{4} DotStories$/)).toBeInTheDocument();
  });

  it("the logo with dotstories.com links home", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "DotStories home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("img", { name: "dotstories.com" })).toBeInTheDocument();
  });
});
