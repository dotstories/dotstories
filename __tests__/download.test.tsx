import { render, screen, waitFor } from "@testing-library/react";
import DownloadApp from "../components/download-app";
import { detectOS, DOWNLOADS } from "../lib/download";

describe("detectOS", () => {
  it("tells Windows, Mac, phones and the rest apart", () => {
    expect(detectOS("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141")).toBe("windows");
    expect(detectOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605")).toBe("mac");
    expect(detectOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("phone");
    expect(detectOS("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile")).toBe("phone");
    expect(detectOS("Mozilla/5.0 (X11; Linux x86_64) Chrome/141")).toBe("other");
  });
});

const release = (exists: boolean) => {
  global.fetch = jest.fn(async () => ({ ok: exists, status: exists ? 200 : 404 })) as unknown as typeof fetch;
};

describe("DownloadApp", () => {
  it("offers the Windows installer on Windows", async () => {
    release(true);
    render(<DownloadApp os="windows" />);
    const button = await screen.findByRole("link", { name: /download for windows/i });
    expect(button).toHaveAttribute("href", DOWNLOADS.windows);
    expect(screen.getByRole("link", { name: /mac/i })).toHaveAttribute("href", DOWNLOADS.mac);
  });

  it("offers the Mac app on a Mac", async () => {
    release(true);
    render(<DownloadApp os="mac" />);
    expect(await screen.findByRole("link", { name: /download for mac/i })).toHaveAttribute("href", DOWNLOADS.mac);
  });

  it("on a phone: explains it needs a computer", async () => {
    release(true);
    render(<DownloadApp os="phone" />);
    expect(await screen.findByText(/needs a windows or mac computer/i)).toBeInTheDocument();
  });

  it("says coming soon when no release is published yet", async () => {
    release(false);
    render(<DownloadApp os="windows" />);
    await waitFor(() => expect(screen.getByText(/first release is coming soon/i)).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /download for windows/i })).not.toBeInTheDocument();
  });
});
