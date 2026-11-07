// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EarnProviderTabs } from "@/components/earn-provider-tabs";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("Offerwall.GG admin preview gate", () => {
  it("is completely absent for normal users", () => {
    render(<EarnProviderTabs cpxLive={false} />);
    expect(screen.queryByRole("tab", { name: "Offerwall.GG Preview" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Offerwall.GG Preview/)).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("embeds a no-money iframe for an authorized admin, as with CPX", async () => {
    const url = "https://offerwall.gg/wall/0123456789abcdef0123456789abcdef?signature=abcdef";
    const fn = vi.fn(async () => ({ ok: true, json: async () => ({ url, previewOnly: true }) }));
    vi.stubGlobal("fetch", fn);
    render(<EarnProviderTabs cpxLive={false} offerwallggPreview />);
    fireEvent.click(screen.getByRole("tab", { name: "Offerwall.GG Preview" }));
    const frame = (await screen.findByTitle(/Offerwall.GG — admin preview only/i)) as HTMLIFrameElement;
    expect(frame.src).toBe(url);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-forms allow-popups");
    expect(frame.getAttribute("allow")).toBe("clipboard-write");
    expect(frame.parentElement).toHaveClass("wall-frame");
    expect(screen.getByText(/rewards disabled/i)).toBeInTheDocument();
    const fallback = screen.getByRole("link", { name: /open the preview in a new tab/i }) as HTMLAnchorElement;
    expect(fallback.href).toBe(url);
    expect(fallback.target).toBe("_blank");
    expect(fallback.rel).toContain("noopener");
    expect(fallback.rel).toContain("noreferrer");
    expect(fn).toHaveBeenCalledWith("/api/providers/offerwallgg/wall", { credentials: "same-origin" });
  });

  it("refuses to embed an accidentally attributable URL", async () => {
    const url = "https://offerwall.gg/wall/0123456789abcdef0123456789abcdef?userId=someone&signature=abcdef";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ url, previewOnly: true }) })));
    render(<EarnProviderTabs cpxLive={false} offerwallggPreview />);
    fireEvent.click(screen.getByRole("tab", { name: "Offerwall.GG Preview" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTitle(/Offerwall.GG — admin preview only/i)).not.toBeInTheDocument();
  });
});
