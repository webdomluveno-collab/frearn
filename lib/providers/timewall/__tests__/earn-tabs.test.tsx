// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EarnProviderTabs } from "@/components/earn-provider-tabs";
import { TimewallWall } from "@/components/timewall-wall";

const TW_URL = "https://timewall.io/users/login?oid=6154a2b1f8661a69&uid=test-user-uuid";

function mockFetch() {
  const fn = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      url: String(url).includes("timewall") ? TW_URL : "https://cpx.test/wall?user=1",
    }),
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("EarnProviderTabs TimeWall (live for authenticated users)", () => {
  it("all users see the TimeWall tab — no test gate, no unavailable copy", () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive />);
    const tab = screen.getByRole("tab", { name: "TimeWall" });
    expect(tab).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByLabelText("TimeWall, currently unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it("a #timewall hash selects the tab directly", () => {
    mockFetch();
    window.history.replaceState(null, "", "#timewall");
    render(<EarnProviderTabs cpxLive />);
    expect(screen.getByRole("tab", { name: "TimeWall" })).toHaveAttribute("aria-selected", "true");
  });

  it("selecting the TimeWall tab shows the launcher and mounts no iframe", async () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive />);
    fireEvent.click(screen.getByRole("tab", { name: "TimeWall" }));
    expect(await screen.findByRole("link", { name: /open timewall/i })).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    // Single-provider discipline: other providers unmount.
    expect(screen.queryByTitle(/complete surveys matched/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/complete offers and tasks/i)).not.toBeInTheDocument();
  });

  it("partner list offers a working TimeWall shortcut", () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive />);
    fireEvent.click(screen.getByRole("button", { name: /timewall.*new tab/i }));
    expect(screen.getByRole("tab", { name: "TimeWall" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("TimewallWall (new-tab launcher)", () => {
  it("shows a loading state instead of a blank rectangle", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<TimewallWall />);
    expect(screen.getByRole("status", { name: "Loading tasks" })).toBeInTheDocument();
    // No action is available while the URL is being fetched (no double-click spam).
    expect(screen.queryByRole("link", { name: /open timewall/i })).not.toBeInTheDocument();
  });

  it("shows a recoverable error with Retry that refetches", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ url: TW_URL }),
    });
    vi.stubGlobal("fetch", fn);
    render(<TimewallWall />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("link", { name: /open timewall/i })).toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("opens the server-minted URL in a new tab, without an iframe or secrets", async () => {
    mockFetch();
    render(<TimewallWall />);
    const link = (await screen.findByRole("link", { name: /open timewall/i })) as HTMLAnchorElement;
    expect(link.href).toContain("oid=6154a2b1f8661a69");
    expect(link.href).toContain("uid=test-user-uuid");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.body.textContent).not.toMatch(/SECRET|service_role/i);
  });
});
