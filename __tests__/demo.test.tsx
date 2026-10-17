import { fireEvent, render, screen } from "@testing-library/react";
import Demo from "../components/demo";
import { latest } from "../lib/dot";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { useBrowserRun } from "../store/run-in-browser";

const TERMS = ["krea2-turbo@1.0"]; // accepted before (logged in, from D1)

const show = (state: object, acceptedTerms: string[] = TERMS, inputs = latest(darkFantasy).inputs) => {
  useBrowserRun.setState({
    phase: { name: "ready" },
    gpu: "NVIDIA GeForce RTX 4080",
    folderName: null,
    image: null,
    init: async () => {},
    ...state,
  });
  const v = latest(darkFantasy);
  render(<Demo dot={darkFantasy} version={v.version} inputs={inputs} onChange={() => {}} loggedIn acceptedTerms={acceptedTerms} />);
};

const MISSING = [{ folder: "diffusion_models", name: "krea2_turbo_fp8_scaled.safetensors", size: 13141730784 }];

describe("Demo", () => {
  it("prefills the dot's prompt", () => {
    show({});
    expect(screen.getByLabelText(/prompt/i)).toHaveValue(darkFantasy.versions[0].inputs.prompt);
  });

  it("ready: says it runs on this GPU, uploads nothing, and asks for a models folder once", () => {
    show({});
    expect(screen.getByText(/runs on nvidia geforce rtx 4080, nothing is uploaded/i)).toBeInTheDocument();
    expect(screen.getByText(/asks once for a models folder/i)).toBeInTheDocument();
  });

  it("names the remembered models folder", () => {
    show({ folderName: "models" });
    expect(screen.getByText("Models folder: models.", { exact: false })).toBeInTheDocument();
  });

  it("Run runs the dot's inputs and post-steps in the browser", () => {
    const run = jest.fn(async () => {});
    show({ run });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(run).toHaveBeenCalledWith(latest(darkFantasy).inputs, latest(darkFantasy).postSteps);
  });

  it("unsupported browser: the reason, Run disabled", () => {
    show({ phase: { name: "unsupported", reason: "This browser has no WebGPU. Use Chrome or Edge on a desktop computer." } });
    expect(screen.getByText(/this browser has no webgpu/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("missing models: lists them with sizes and offers the download", () => {
    const download = jest.fn(async () => {});
    show({ phase: { name: "missing", missing: MISSING, bytes: 13141730784 }, download });
    const panel = screen.getByRole("region", { name: "Missing models" });
    expect(panel).toHaveTextContent("diffusion_models/krea2_turbo_fp8_scaled.safetensors · 13.1 GB");
    expect(panel).toHaveTextContent(/hugging face/i);
    fireEvent.click(screen.getByRole("button", { name: "Download 13.1 GB" }));
    expect(download).toHaveBeenCalled();
  });

  it("downloading: progress in GB and Cancel", () => {
    const cancel = jest.fn();
    show({ phase: { name: "downloading", done: 2e9, total: 13141730784, file: "krea2_turbo_fp8_scaled.safetensors" }, cancel });
    expect(screen.getByText("2.0 GB of 13.1 GB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("making the image: the engine's progress and Cancel", () => {
    show({ phase: { name: "making", progress: { stage: "steps", message: "Step 3 of 8…", fraction: 0.5 } } });
    expect(screen.getByText("Step 3 of 8…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("says when the browser adds the finishing touches", () => {
    show({ phase: { name: "shading" } });
    expect(screen.getByText(/adding title and effects in your browser/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("shows the result image and the time when done", () => {
    show({ phase: { name: "done", seconds: 207 }, image: "blob:result" });
    expect(screen.getByRole("img", { name: /your result/i })).toHaveAttribute("src", "blob:result");
    expect(screen.getByText("Done in 207 s.")).toBeInTheDocument();
  });

  it("shows errors", () => {
    show({ phase: { name: "error", message: "No WebGPU adapter" } });
    expect(screen.getByText("No WebGPU adapter")).toBeInTheDocument();
  });

  it("an edited prompt: says the author's prompt refine is not applied", () => {
    show({}, TERMS, { ...latest(darkFantasy).inputs, finalPrompt: undefined, prompt: "A tower" });
    expect(screen.getByText(/used as you wrote it/i)).toBeInTheDocument();
  });

  it("shows the license", () => {
    show({});
    expect(screen.getByText(/krea 2 community license/i)).toBeInTheDocument();
  });

  describe("model terms (first run on a model)", () => {
    beforeEach(() => localStorage.clear());

    it("asks to accept the terms first; Run waits for the checkbox", () => {
      const start = jest.fn(async () => {});
      show({ phase: { name: "ready" }, run: start }, []);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));

      expect(screen.getByText(/krea 2 turbo · terms of use/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Krea 2 Community License" })).toHaveAttribute(
        "href",
        "https://www.krea.ai/krea-2-licensing",
      );
      expect(screen.getByRole("link", { name: "all key points" })).toHaveAttribute("href", "/models/krea2-turbo");
      expect(screen.getByRole("button", { name: "Accept and run" })).toBeDisabled();
      expect(start).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("checkbox", { name: /i have read and agree/i }));
      fireEvent.click(screen.getByRole("button", { name: "Accept and run" }));
      expect(start).toHaveBeenCalledTimes(1);
      expect(JSON.parse(localStorage.getItem("dotstories:model-terms")!)).toEqual(["krea2-turbo@1.0"]);
    });

    it("cancel: nothing runs", () => {
      const start = jest.fn(async () => {});
      show({ phase: { name: "ready" }, run: start }, []);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(start).not.toHaveBeenCalled();
    });

    it("accepted before in this browser: runs at once", () => {
      localStorage.setItem("dotstories:model-terms", JSON.stringify(["krea2-turbo@1.0"]));
      const start = jest.fn(async () => {});
      show({ phase: { name: "ready" }, run: start }, []);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      expect(start).toHaveBeenCalledTimes(1);
    });

    it("older terms don't count: new version, ask again", () => {
      localStorage.setItem("dotstories:model-terms", JSON.stringify(["krea2-turbo@0.9"]));
      const start = jest.fn(async () => {});
      show({ phase: { name: "ready" }, run: start }, []);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      expect(start).not.toHaveBeenCalled();
    });
  });
});
