import { render, screen } from "@testing-library/react";
import CodeOfConduct from "../app/code-of-conduct/page";
import Cookies from "../app/cookies/page";
import Privacy from "../app/privacy/page";
import ModelPage, { generateStaticParams } from "../app/models/[engine]/page";
import Terms from "../app/terms/page";
import { MODELS } from "../lib/models";

const models = Object.values(MODELS).filter((m) => m !== undefined);

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

  it("lists every model with its key points page and license", () => {
    render(<Terms />);
    for (const m of models) {
      expect(screen.getByRole("link", { name: m.name })).toHaveAttribute("href", `/models/${m.engine}`);
      expect(screen.getByRole("link", { name: m.license.name })).toHaveAttribute("href", m.license.url);
    }
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

  it("protects the platform like itch.io: indemnity, warranty, transfer, everything else", () => {
    render(<Terms />);
    // indemnity: defend, hold harmless, pay damages and costs, incl. lawyers
    expect(text()).toMatch(/defend us and hold us harmless/i);
    expect(text()).toMatch(/you pay for our damages and costs if your dots, content or actions cause damage to someone else/i);
    expect(text()).toMatch(/reasonable lawyers' fees/i);
    // accounts
    expect(text()).toMatch(/accounts can't be transferred/i);
    // use, content, copyright
    expect(text()).toMatch(/collect other people's personal data/i);
    expect(text()).toMatch(/to promote DotStories/i);
    expect(text()).toMatch(/copyright notice/i);
    expect(text()).toMatch(/counter-notice|object to our decision/i);
    // warranty, liability
    expect(text()).toMatch(/always available, error-free or secure/i);
    expect(text()).toMatch(/third-party sites and services/i);
    expect(text()).toMatch(/goodwill/i);
    // ending, transfer, other
    expect(text()).toMatch(/still apply after your account ends/i);
    expect(text()).toMatch(/you may not transfer these terms/i);
    expect(text()).toMatch(/whole agreement/i);
    expect(text()).toMatch(/not a waiver/i);
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

describe("model key points pages", () => {
  const text = () => document.body.textContent ?? "";
  const renderModel = async (engine: string) => render(await ModelPage({ params: Promise.resolve({ engine }) }));

  it("one page per model", () => {
    expect(generateStaticParams()).toEqual(models.map((m) => ({ engine: m.engine })));
  });

  it.each(models.map((m) => [m.name, m] as const))("%s: use, out of scope, training data, safety, risks, license, reporting", async (_, m) => {
    await renderModel(m.engine);
    expect(screen.getByRole("heading", { level: 1, name: m.name })).toBeInTheDocument();
    for (const h of ["Capabilities and intended use", "Out-of-scope uses", "Training data", "Safety", "Risks and limitations",
      "License and outputs", "Reporting and contact"]) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link", { name: m.license.name })[0]).toHaveAttribute("href", m.license.url);
    expect(text()).toMatch(/own documents always win/i);
  });

  it("Krea 2: where to report", async () => {
    await renderModel("krea2-turbo");
    expect(screen.getByRole("link", { name: "safety@krea.ai" })).toHaveAttribute("href", "mailto:safety@krea.ai");
  });

  it("Stable Audio 3: 18+, Powered by Stability AI, Gemma terms", async () => {
    await renderModel("stable-audio-3");
    expect(text()).toMatch(/18 or older/);
    expect(text()).toMatch(/Powered by Stability AI/);
    expect(text()).toMatch(/Gemma Terms of Use/);
    expect(screen.getAllByRole("link", { name: "Stability AI Community License" })[0]).toHaveAttribute("href", "https://stability.ai/community-license-agreement");
  });
});
