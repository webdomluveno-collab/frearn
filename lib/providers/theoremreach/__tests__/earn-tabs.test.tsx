// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EarnProviderTabs } from "@/components/earn-provider-tabs";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("TheoremReach Earn UI gate", () => {
  it("does not expose a tab or partner card while disabled", () => {
    render(<EarnProviderTabs cpxLive={false} />);
    expect(screen.queryByRole("tab", { name: "TheoremReach" })).not.toBeInTheDocument();
    expect(screen.queryByText(/TheoremReach/)).not.toBeInTheDocument();
  });

  it("uses the authenticated server route and opens its URL in a new tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () => ({ url: `${url}?server_minted=true` }),
      }))
    );
    render(<EarnProviderTabs cpxLive={false} theoremreachLive />);
    fireEvent.click(screen.getByRole("tab", { name: "TheoremReach" }));
    const link = (await screen.findByRole("link", { name: /open theoremreach/i })) as HTMLAnchorElement;
    expect(link.href).toContain("/api/providers/theoremreach/wall?server_minted=true");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/providers/theoremreach/wall", { credentials: "same-origin" });
    expect(document.body.textContent).not.toMatch(/api[_ -]?key|secret[_ -]?key|service_role/i);
  });
});
