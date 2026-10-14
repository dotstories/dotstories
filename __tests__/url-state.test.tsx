import { act, fireEvent, render, screen } from "@testing-library/react";
import DotRunner from "../components/dot-runner";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { SYNC_MS } from "../lib/use-dot-state";
import { mockRouter } from "../jest.setup";
import { useRunStore } from "../store/run";
import { saveDotState } from "../actions/dot-state";

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  window.history.replaceState(null, "", "/dots/dark-fantasy-thumbnail");
  mockRouter.replace.mockClear();
  jest.mocked(saveDotState).mockClear();
  useRunStore.setState({ runner: { state: "missing" }, job: null, image: null, error: null, shading: false, checkRunner: async () => {} });
});
afterEach(() => jest.useRealTimers());

const settle = () => act(() => jest.advanceTimersByTime(SYNC_MS + 10));

it("typing a prompt puts it in the URL and localStorage", () => {
  render(<DotRunner dot={darkFantasy} />);
  fireEvent.change(screen.getByLabelText(/prompt/i), { target: { value: "A lone tower" } });
  settle();
  expect(new URLSearchParams(window.location.search).get("prompt")).toBe("A lone tower");
  expect(JSON.parse(localStorage.getItem("dotstories:dot:dark-fantasy-thumbnail")!)).toMatchObject({ prompt: "A lone tower" });
});

it("changing the seed puts it in the URL", () => {
  render(<DotRunner dot={darkFantasy} />);
  fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "42" } });
  fireEvent.blur(screen.getByLabelText("Seed"));
  settle();
  expect(new URLSearchParams(window.location.search).get("seed")).toBe("42");
});

it("a link with a setup shows that setup", () => {
  render(<DotRunner dot={darkFantasy} initial={{ prompt: "From a shared link", seed: 7 }} />);
  expect(screen.getByLabelText(/prompt/i)).toHaveValue("From a shared link");
  expect(screen.getByLabelText("Seed")).toHaveValue(7);
});

it("a visit without a link brings back this browser's last setup", () => {
  localStorage.setItem("dotstories:dot:dark-fantasy-thumbnail", JSON.stringify({ prompt: "Saved before" }));
  render(<DotRunner dot={darkFantasy} />);
  expect(mockRouter.replace).toHaveBeenCalledWith("?prompt=Saved+before", { scroll: false });
});

it("a link wins over what this browser saved", () => {
  localStorage.setItem("dotstories:dot:dark-fantasy-thumbnail", JSON.stringify({ prompt: "Saved before" }));
  window.history.replaceState(null, "", "/dots/dark-fantasy-thumbnail?prompt=Shared");
  render(<DotRunner dot={darkFantasy} initial={{ prompt: "Shared" }} />);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it("opening the page doesn't overwrite what was saved", () => {
  localStorage.setItem("dotstories:dot:dark-fantasy-thumbnail", JSON.stringify({ prompt: "Saved before" }));
  render(<DotRunner dot={darkFantasy} />);
  settle();
  expect(JSON.parse(localStorage.getItem("dotstories:dot:dark-fantasy-thumbnail")!)).toEqual({ prompt: "Saved before" });
});

describe("logged in", () => {
  it("remembers changes in the account, not in this browser", () => {
    render(<DotRunner dot={darkFantasy} loggedIn />);
    fireEvent.change(screen.getByLabelText(/prompt/i), { target: { value: "On every device" } });
    settle();
    expect(saveDotState).toHaveBeenCalledWith("dark-fantasy-thumbnail", expect.objectContaining({ prompt: "On every device" }));
    expect(new URLSearchParams(window.location.search).get("prompt")).toBe("On every device");
    expect(localStorage.getItem("dotstories:dot:dark-fantasy-thumbnail")).toBeNull();
  });

  it("doesn't restore this browser's setup (the server brings the account's)", () => {
    localStorage.setItem("dotstories:dot:dark-fantasy-thumbnail", JSON.stringify({ prompt: "Saved before" }));
    render(<DotRunner dot={darkFantasy} loggedIn />);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("opening the page saves nothing", () => {
    render(<DotRunner dot={darkFantasy} loggedIn />);
    settle();
    expect(saveDotState).not.toHaveBeenCalled();
  });
});
