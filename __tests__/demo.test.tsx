import { fireEvent, render, screen } from "@testing-library/react";
import Demo from "../components/demo";
import { latest } from "../lib/dot";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { useRunStore } from "../store/run";

const TERMS = ["krea2-turbo@1.0"]; // accepted before (logged in, from D1)

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

const show = (state: object, acceptedTerms: string[] = TERMS) => {
  useRunStore.setState({
    job: null,
    image: null,
    error: null,
    shading: false,
    installing: false,
    logs: [],
    access: null,
    init: async () => {},
    checkRunner: async () => {},
    ...state,
  });
  const v = latest(darkFantasy);
  render(
    <Demo
      dot={darkFantasy}
      version={v.version}
      inputs={v.inputs}
      onChange={() => {}}
      loggedIn
      acceptedTerms={acceptedTerms}
    />,
  );
};

describe("Demo", () => {
  it("prefills the dot's prompt", () => {
    show({ runner: { state: "checking" } });
    expect(screen.getByLabelText(/prompt/i)).toHaveValue(darkFantasy.versions[0].inputs.prompt);
  });

  it("without the app, Run installs it (one click)", () => {
    const start = jest.fn(async () => {});
    show({ runner: { state: "missing" }, start });
    expect(screen.getByText(/press run to install it/i)).toBeInTheDocument();
    expect(screen.getByText(/get the free dotstories app/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(start).toHaveBeenCalledWith(latest(darkFantasy).inputs, latest(darkFantasy).postSteps, expect.any(Function));
  });

  it("before the browser asked: explains the Allow question, Run is enabled", () => {
    show({ runner: { state: "idle" } });
    expect(screen.getByText(/click allow/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
  });

  it("when the browser blocks the app: says how to allow it, Run is disabled", () => {
    show({ runner: { state: "blocked" } });
    expect(screen.getByText(/your browser blocks the connection/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("shows the app's setup log live", () => {
    show({
      runner: {
        state: "setup",
        setup: { phase: "installing", message: "Installing AI libraries…", version: "0.2.0", next: 2, lines: [] },
      },
      logs: [
        { n: 0, t: 1, text: "Resolved 84 packages" },
        { n: 1, t: 65, text: "Downloading torch (2.4 GiB)" },
      ],
    });
    const log = screen.getByRole("log", { name: /setup log/i });
    expect(log).toHaveTextContent("0:01Resolved 84 packages");
    expect(log).toHaveTextContent("1:05Downloading torch (2.4 GiB)");
    expect(screen.getAllByText("Installing AI libraries…").length).toBeGreaterThan(0);
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
    show({ runner: { state: "ready", info: INFO } });
    expect(screen.getByText(/krea 2 community license/i)).toBeInTheDocument();
  });

  it("says when the browser adds the finishing touches", () => {
    show({ runner: { state: "ready", info: INFO }, shading: true });
    expect(screen.getByText(/adding title and effects in your browser/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  describe("model terms (first run on a model)", () => {
    beforeEach(() => localStorage.clear());

    it("asks to accept the terms first; Run waits for the checkbox", () => {
      const start = jest.fn(async () => {});
      show({ runner: { state: "ready", info: INFO }, start }, []);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));

      expect(screen.getByText(/krea 2 turbo · terms of use/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Krea 2 Community License" })).toHaveAttribute(
        "href",
        "https://www.krea.ai/krea-2-licensing",
      );
      expect(screen.getByRole("button", { name: "Accept and run" })).toBeDisabled();
      expect(start).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("checkbox", { name: /i have read and agree/i }));
      fireEvent.click(screen.getByRole("button", { name: "Accept and run" }));
      expect(start).toHaveBeenCalledTimes(1);
      expect(JSON.parse(localStorage.getItem("dotstories:model-terms")!)).toEqual(["krea2-turbo@1.0"]);
    });

    it("cancel: nothing runs", () => {
      const start = jest.fn(async () => {});
      show({ runner: { state: "ready", info: INFO }, start }, []);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(start).not.toHaveBeenCalled();
    });

    it("accepted before in this browser: runs at once", () => {
      localStorage.setItem("dotstories:model-terms", JSON.stringify(["krea2-turbo@1.0"]));
      const start = jest.fn(async () => {});
      show({ runner: { state: "ready", info: INFO }, start }, []);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      expect(start).toHaveBeenCalledTimes(1);
    });

    it("older terms don't count: new version, ask again", () => {
      localStorage.setItem("dotstories:model-terms", JSON.stringify(["krea2-turbo@0.9"]));
      const start = jest.fn(async () => {});
      show({ runner: { state: "ready", info: INFO }, start }, []);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      expect(start).not.toHaveBeenCalled();
    });
  });

  describe("Hugging Face access", () => {
    const access = (status: string) => ({ model: "krea/Krea-2-Turbo", status, url: "https://huggingface.co/krea/Krea-2-Turbo" });

    it("explains the steps and saves the token to the app", () => {
      const saveToken = jest.fn(async () => {});
      show({ runner: { state: "ready", info: INFO }, access: access("no-token"), saveToken });
      const card = screen.getByRole("region", { name: /get access to krea 2 turbo/i });
      expect(card).toHaveTextContent(/never sent to dotstories\.com/i);
      expect(screen.getByRole("link", { name: /krea 2 turbo page/i })).toHaveAttribute(
        "href",
        "https://huggingface.co/krea/Krea-2-Turbo",
      );
      fireEvent.change(screen.getByLabelText("Hugging Face token"), { target: { value: "hf_abc" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to the app" }));
      expect(saveToken).toHaveBeenCalledWith("hf_abc");
    });

    it("terms not accepted on Hugging Face yet: says so, Check again", () => {
      const recheckAccess = jest.fn(async () => {});
      show({ runner: { state: "ready", info: INFO }, access: access("not-accepted"), recheckAccess });
      expect(screen.getByRole("status")).toHaveTextContent(/aren't accepted on this hugging face account/i);
      fireEvent.click(screen.getByRole("button", { name: "Check again" }));
      expect(recheckAccess).toHaveBeenCalled();
    });
  });
});
