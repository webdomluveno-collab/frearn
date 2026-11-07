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
  });

  it("shows a no-money preview to an authorized admin", async () => {
    const url = "https://offerwall.gg/wall/0123456789abcdef0123456789abcdef?signature=abcdef";
    const fn = vi.fn(async () => ({ ok: true, json: async () => ({ url, previewOnly: true }) }));
    vi.stubGlobal("fetch", fn);
    render(<EarnProviderTabs cpxLive={false} offerwallggPreview />);
    fireEvent.click(screen.getByRole("tab", { name: "Offerwall.GG Preview" }));
    const link = (await screen.findByRole("link", { name: /open offerwall.gg preview/i })) as HTMLAnchorElement;
    expect(link.href).toBe(url);
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
    expect(screen.getByText(/rewards disabled/i)).toBeInTheDocument();
    expect(fn).toHaveBeenCalledWith("/api/providers/offerwallgg/wall", { credentials: "same-origin" });
  });
});
