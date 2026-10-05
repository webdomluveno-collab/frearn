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

describe("EarnProviderTabs TimeWall gating (controlled live test)", () => {
  it("normal users see no TimeWall tab, panel, or iframe", () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive />);
    expect(screen.queryByRole("tab", { name: /timewall/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle(/timewall tasks/i)).not.toBeInTheDocument();
    // The honest unavailable state remains.
    expect(screen.getByLabelText("TimeWall, currently unavailable")).toBeInTheDocument();
  });

  it("a #timewall hash cannot force the tab for normal users", () => {
    mockFetch();
    window.history.replaceState(null, "", "#timewall");
    render(<EarnProviderTabs cpxLive />);
    expect(screen.queryByRole("tab", { name: /timewall/i })).not.toBeInTheDocument();
    // Falls back to Surveys content, not a broken panel.
    expect(screen.getByRole("tab", { name: "Surveys" })).toHaveAttribute("aria-selected", "true");
  });

  it("test account sees the TimeWall tab labeled as test access", () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive timewallTestAccess />);
    const tab = screen.getByRole("tab", { name: /timewall/i });
    expect(tab).toHaveAttribute("aria-selected", "false");
    expect(tab.textContent).toMatch(/test/i);
  });

  it("selecting the TimeWall tab mounts only its wall with the server URL", async () => {
    const fetch = mockFetch();
    render(<EarnProviderTabs cpxLive timewallTestAccess />);
    fireEvent.click(screen.getByRole("tab", { name: /timewall/i }));
    const iframe = (await screen.findByTitle(/timewall tasks/i)) as HTMLIFrameElement;
    expect(fetch).toHaveBeenCalledWith("/api/providers/timewall/wall", expect.anything());
    // Server-minted URL: official placement preserved, session UUID attached.
    expect(iframe.src).toContain("oid=6154a2b1f8661a69");
    expect(iframe.src).toContain("uid=test-user-uuid");
    expect(iframe.src).not.toContain("userid=");
    // Single-iframe discipline: other providers unmount.
    expect(screen.queryByTitle(/complete surveys matched/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/complete offers and tasks/i)).not.toBeInTheDocument();
  });

  it("partner list offers a working TimeWall shortcut only to the test account", () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive timewallTestAccess />);
    fireEvent.click(screen.getByRole("button", { name: /timewall.*test access/i }));
    expect(screen.getByRole("tab", { name: /timewall/i })).toHaveAttribute("aria-selected", "true");
  });
});

describe("TimewallWall", () => {
  it("shows a loading state instead of a blank rectangle", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<TimewallWall />);
    expect(screen.getByRole("status", { name: "Loading tasks" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByTitle(/timewall tasks/i)).toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("renders no secrets and constrains the iframe", async () => {
    mockFetch();
    render(<TimewallWall />);
    const iframe = (await screen.findByTitle(/timewall tasks/i)) as HTMLIFrameElement;
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-forms allow-popups");
    expect(iframe.hasAttribute("allow")).toBe(false);
    expect(document.body.textContent).not.toMatch(/SECRET|service_role/i);
  });
});
