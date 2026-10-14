import { fireEvent, render, screen } from "@testing-library/react";
import DotCard from "../components/dot-card";
import DotRunner from "../components/dot-runner";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { dots, findDot } from "../lib/dots";
import { useRunStore } from "../store/run";

beforeEach(() =>
  useRunStore.setState({
    runner: { state: "missing" },
    job: null,
    image: null,
    error: null,
    shading: false,
    checkRunner: async () => {},
  }),
);

describe("dot registry", () => {
  it("finds dots by slug", () => {
    expect(findDot("dark-fantasy-thumbnail")).toBe(darkFantasy);
    expect(findDot("nope")).toBeUndefined();
    expect(dots.length).toBeGreaterThan(0);
  });

  it("slugs are unique", () => {
    expect(new Set(dots.map((d) => d.slug)).size).toBe(dots.length);
  });
});

describe("DotCard", () => {
  it("links to the dot page with name and kind", () => {
    render(<DotCard dot={darkFantasy} />);
    const card = screen.getByRole("link", { name: /dark fantasy thumbnail/i });
    expect(card).toHaveAttribute("href", "/dots/dark-fantasy-thumbnail");
    expect(screen.getByText("Image")).toBeInTheDocument();
  });
});

describe("DotRunner", () => {
  const twoVersions = {
    ...darkFantasy,
    versions: [
      darkFantasy.versions[0],
      {
        ...darkFantasy.versions[0],
        version: "1.1.0",
        changelog: "Brighter fog.",
        inputs: { ...darkFantasy.versions[0].inputs, prompt: "A newer prompt" },
      },
    ],
  };

  it("starts on the latest version", () => {
    render(<DotRunner dot={twoVersions} />);
    expect(screen.getByLabelText(/prompt/i)).toHaveValue("A newer prompt");
    expect(screen.getByText("Brighter fog.")).toBeInTheDocument();
  });

  it("can switch to an older version", () => {
    render(<DotRunner dot={twoVersions} />);
    fireEvent.change(screen.getByLabelText("Version"), { target: { value: "1.0.0" } });
    expect(screen.getByLabelText(/prompt/i)).toHaveValue(darkFantasy.versions[0].inputs.prompt);
  });
});
