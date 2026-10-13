import { render, screen } from "@testing-library/react";
import Demo from "../components/demo";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { useRunStore } from "../store/run";

const INFO = {
  hardware: { device: "cuda", name: "RTX 4080", vram_gb: 16, ram_gb: 32 },
  tier: "nvidia-16",
  plan: "gpu-fp8-offload",
  estimate: {
    run_seconds: [5, 15] as [number, number],
    label: "~5–15 seconds",
    download_gb: 36,
    download_minutes: 36,
    warning: null,
  },
};

const show = (state: object) => {
  useRunStore.setState({ job: null, image: null, error: null, shading: false, checkRunner: async () => {}, ...state });
  render(<Demo dot={darkFantasy} />);
};

describe("Demo", () => {
  it("prefills the dot's prompt", () => {
    show({ runner: { state: "checking" } });
    expect(screen.getByLabelText(/prompt/i)).toHaveValue(darkFantasy.versions[0].inputs.prompt);
  });

  it("Run is disabled until the app is found", () => {
    show({ runner: { state: "missing" } });
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
    expect(screen.getByText(/get the free dotstories app/i)).toBeInTheDocument();
  });

  it("shows hardware and time estimate when the app is found", () => {
    show({ runner: { state: "ready", info: INFO } });
    expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
    expect(screen.getByText(/ready on rtx 4080 · ~5–15 seconds/i)).toBeInTheDocument();
    expect(screen.getByText(/first run downloads 36 gb/i)).toBeInTheDocument();
  });

  it("shows a warning for slow computers", () => {
    show({
      runner: { state: "ready", info: { ...INFO, estimate: { ...INFO.estimate, warning: "Your computer has no GPU." } } },
    });
    expect(screen.getByText("Your computer has no GPU.")).toBeInTheDocument();
  });

  it("shows progress while running", () => {
    show({
      runner: { state: "ready", info: INFO },
      job: { id: "a", status: "running", progress: { step: 3, steps: 8, eta: 4.2 }, error: null },
    });
    expect(screen.getByText("Step 3/8 · ~5 s left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("shows the result image when done", () => {
    show({ runner: { state: "ready", info: INFO }, image: "http://127.0.0.1:47761/jobs/a/image" });
    expect(screen.getByRole("img", { name: /your result/i })).toHaveAttribute(
      "src",
      "http://127.0.0.1:47761/jobs/a/image",
    );
  });

  it("shows the license", () => {
    show({ runner: { state: "missing" } });
    expect(screen.getByText(/krea 2 community license/i)).toBeInTheDocument();
  });

  it("says when the browser adds the finishing touches", () => {
    show({ runner: { state: "ready", info: INFO }, shading: true });
    expect(screen.getByText(/adding title and effects in your browser/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });
});
