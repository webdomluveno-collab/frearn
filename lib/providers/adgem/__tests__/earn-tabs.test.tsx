// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdGemOfferWall } from "@/components/adgem-offer-wall";
import { EarnProviderTabs } from "@/components/earn-provider-tabs";

const CPX_URL = "https://cpx.test/wall?user=1";
const ADGEM_URL = "https://adunits.adgem.com/wall?appid=33683&playerid=u-1";
const TIMEWALL_URL = "https://timewall.io/users/login?oid=test&uid=some-test-user";

function mockFetch() {
  const fn = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      url: String(url).includes("adgem") ? ADGEM_URL : String(url).includes("timewall") ? TIMEWALL_URL : CPX_URL,
    }),
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // The tabs sync selection to location.hash: reset it so each test starts
  // from the default (Surveys) tab regardless of previous navigation.
  window.history.replaceState(null, "", window.location.pathname);
});

describe("EarnProviderTabs", () => {
  it("hides the empty AdGem tab, defaults to Surveys, and retains TimeWall for users", () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive />);
    expect(screen.getByRole("tab", { name: "Surveys" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Offers & Games" })).not.toBeInTheDocument();
    expect(screen.queryByText(/AdGem/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("aria-label"))).toEqual(["Surveys", "TimeWall"]);
  });

  it("mounts only the selected provider wall", async () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive />);
    expect(await screen.findByTitle(/complete surveys matched/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/complete offers and tasks/i)).not.toBeInTheDocument();
  });

  it("switches between CPX and TimeWall instead of the empty AdGem wall", async () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive />);
    await screen.findByTitle(/complete surveys matched/i);
    fireEvent.click(screen.getByRole("tab", { name: "TimeWall" }));
    expect(await screen.findByRole("link", { name: /Open TimeWall/i })).toBeInTheDocument();
    expect(screen.queryByTitle(/complete surveys matched/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/complete offers and tasks/i)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "TimeWall" })).toHaveAttribute("aria-selected", "true");
  });

  it("supports keyboard navigation between remaining providers", async () => {
    mockFetch();
    render(<EarnProviderTabs cpxLive />);
    const surveys = screen.getByRole("tab", { name: "Surveys" });
    surveys.focus();
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(await screen.findByRole("link", { name: /Open TimeWall/i })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(await screen.findByTitle(/complete surveys matched/i)).toBeInTheDocument();
  });

  it("routes legacy #offers bookmarks to TimeWall for regular users", () => {
    mockFetch();
    window.history.replaceState(null, "", "#offers");
    render(<EarnProviderTabs cpxLive />);
    expect(screen.getByRole("tab", { name: "TimeWall" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("AdGemOfferWall", () => {
  it("shows a loading state instead of a blank rectangle", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<AdGemOfferWall />);
    expect(screen.getByRole("status", { name: "Loading offers" })).toBeInTheDocument();
  });

  it("shows a recoverable error with Retry that refetches", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ url: ADGEM_URL }) });
    vi.stubGlobal("fetch", fn);
    render(<AdGemOfferWall />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByTitle(/complete offers and tasks/i)).toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("renders the wall iframe with accessible title once loaded", async () => {
    mockFetch();
    render(<AdGemOfferWall />);
    const iframe = (await screen.findByTitle(/complete offers and tasks/i)) as HTMLIFrameElement;
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.src).toBe(ADGEM_URL);
  });
});
