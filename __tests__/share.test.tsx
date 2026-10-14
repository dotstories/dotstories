import { fireEvent, render, screen } from "@testing-library/react";
import ActionBar from "../components/action-bar";
import { latest } from "../lib/dot";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { setupJson, shareLinks, shareUrl, timeAgo } from "../lib/share";

const SITE = "https://dotstories.com";

describe("shareUrl", () => {
  it("is the dot page with the visitor's setup", () => {
    expect(shareUrl(darkFantasy, {})).toBe(`${SITE}/dots/dark-fantasy-thumbnail`);
    expect(shareUrl(darkFantasy, { prompt: "A tower", seed: 7 })).toBe(
      `${SITE}/dots/dark-fantasy-thumbnail?prompt=A+tower&seed=7`,
    );
  });
});

describe("setupJson", () => {
  it("has everything to reproduce the result", () => {
    const setup = JSON.parse(setupJson(darkFantasy, { seed: 7 }));
    expect(setup).toMatchObject({
      dot: `${SITE}/dots/dark-fantasy-thumbnail`,
      version: "1.0.0",
      engine: "krea2-turbo",
      inputs: { ...latest(darkFantasy).inputs, seed: 7 },
    });
    expect(setup.postSteps[0].text.title).toBe("The Weeping Gate");
  });
});

describe("shareLinks", () => {
  it("builds X and Reddit links with the dot name", () => {
    const { x, reddit } = shareLinks(darkFantasy, `${SITE}/dots/a`);
    expect(x).toBe(
      "https://x.com/intent/post?text=Dark+Fantasy+Thumbnail+on+DotStories&url=https%3A%2F%2Fdotstories.com%2Fdots%2Fa",
    );
    expect(reddit).toContain("reddit.com/submit?url=https%3A%2F%2Fdotstories.com%2Fdots%2Fa");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  it("reads like the old DotStories", () => {
    expect(timeAgo("2026-10-14T11:59:30Z", now)).toBe("now");
    expect(timeAgo("2026-10-14T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-10-13", now)).toBe("yesterday");
    expect(timeAgo("2026-08-01", now)).toBe("2 months ago");
  });
});

describe("ActionBar", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => {}) } });
  });

  const bar = () =>
    render(<ActionBar dot={darkFantasy} state={{ prompt: "A tower" }} stats={{ views: 1378, likes: 12, comments: 3 }} />);

  it("shows likes, comments and views", () => {
    bar();
    expect(screen.getByText("1,378 Views")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /3 comments/i })).toHaveAttribute("href", "#comments");
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("copies the link with the current setup", async () => {
    bar();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(await screen.findByText("Copy link"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${SITE}/dots/dark-fantasy-thumbnail?prompt=A+tower`);
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });

  it("copies the setup as JSON", async () => {
    bar();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(await screen.findByText("Copy setup"));
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
    expect(JSON.parse(copied).inputs.prompt).toBe("A tower");
    expect(await screen.findByText("Setup copied")).toBeInTheDocument();
  });
});
