import { render, screen } from "@testing-library/react";
import Home from "../app/page";
import { useRunStore } from "../store/run";

// A server component: call it like Next does, then render what it returns.
const home = async (search: Record<string, string> = {}) =>
  render(await Home({ params: Promise.resolve({}), searchParams: Promise.resolve(search) }));

beforeEach(() =>
  useRunStore.setState({ runner: { state: "missing" }, job: null, image: null, error: null, shading: false, checkRunner: async () => {} }),
);

describe("Home", () => {
  it("shows the brand and tagline", async () => {
    await home();
    expect(screen.getByRole("heading", { level: 1, name: "DotStories" })).toBeInTheDocument();
    expect(screen.getByText("What is possible today with AI.")).toBeInTheDocument();
  });

  it("shows an example result made with a dot", async () => {
    await home();
    expect(screen.getByRole("img", { name: /the weeping gate/i })).toBeInTheDocument();
  });

  it("opens with the setup from the link", async () => {
    await home({ prompt: "From a link" });
    expect(screen.getByLabelText(/prompt/i)).toHaveValue("From a link");
  });
});
