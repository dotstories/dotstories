import { render, screen } from "@testing-library/react";
import CodeOfConduct from "../app/code-of-conduct/page";
import Cookies from "../app/cookies/page";
import Privacy from "../app/privacy/page";
import Terms from "../app/terms/page";

describe.each([
  ["Terms of Service", Terms],
  ["Privacy Policy", Privacy],
  ["Cookie Policy", Cookies],
  ["Code of Conduct", CodeOfConduct],
])("%s", (title, Page) => {
  it("has its title, the date and who runs DotStories", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "info@dotstories.com" }).length).toBeGreaterThan(0);
  });
});

describe("Terms", () => {
  const text = () => document.body.textContent ?? "";

  it("is a community: open source, Code of Conduct", () => {
    render(<Terms />);
    expect(text()).toMatch(/open source community/i);
    expect(screen.getAllByRole("link", { name: "Code of Conduct" })[0]).toHaveAttribute("href", "/code-of-conduct");
  });

  it("every model's key points: use, out of scope, training data, safety, risks, license, reporting", () => {
    render(<Terms />);
    for (const h of ["Capabilities and intended use", "Out-of-scope uses", "Training data", "Safety", "Risks and limitations",
      "License and outputs", "Reporting and contact"]) {
      expect(screen.getByRole("heading", { level: 4, name: h })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Krea 2 Community License" })).toHaveAttribute("href", "https://www.krea.ai/krea-2-licensing");
    expect(screen.getAllByRole("link", { name: "safety@krea.ai" }).length).toBeGreaterThan(0);
  });

  it("the required rules", () => {
    render(<Terms />);
    expect(text()).toMatch(/must follow the terms of every AI model/i);
    expect(text()).toMatch(/no sexual content or pornography/i);
    expect(text()).toMatch(/under the license of the model/i);
    expect(text()).toMatch(/at your own risk/i);
    expect(text()).toMatch(/taken down at any time/i);
    expect(text()).toMatch(/change these terms at any time/i);
    expect(text()).toMatch(/your responsibility to read/i);
  });

  it("free for everyone", () => {
    render(<Terms />);
    expect(text()).toMatch(/DotStories is free/);
  });

  it("16+, reporting, Dutch law", () => {
    render(<Terms />);
    expect(text()).toMatch(/at least 16 years old/);
    expect(text()).toMatch(/report illegal content/i);
    expect(text()).toMatch(/Dutch law applies/);
  });
});

it("privacy: the Hugging Face token stays on your computer; Dutch authority", () => {
  render(<Privacy />);
  expect(document.body.textContent).toMatch(/Hugging Face token stays on your computer/i);
  expect(screen.getByRole("link", { name: "Autoriteit Persoonsgegevens" })).toHaveAttribute("href", "https://autoriteitpersoonsgegevens.nl");
});

it("cookies: only what is needed, listed", () => {
  render(<Cookies />);
  expect(screen.getByText("authjs.session-token")).toBeInTheDocument();
  expect(screen.getByText("dotstories:model-terms")).toBeInTheDocument();
  expect(document.body.textContent).toMatch(/No analytics, no advertising/);
});

it("code of conduct: be kind, no doxxing, how to report", () => {
  render(<CodeOfConduct />);
  expect(document.body.textContent).toMatch(/assume positive intent/i);
  expect(document.body.textContent).toMatch(/doxxing/i);
  expect(document.body.textContent).toMatch(/report/i);
});
