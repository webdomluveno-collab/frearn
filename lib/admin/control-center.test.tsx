import { mkdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), report: vi.fn(), notFound: vi.fn(() => { throw new Error("404"); }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/auth/server", () => ({ getSessionUser: mocks.user, isAdminEmail: mocks.admin }));
vi.mock("@/lib/admin/control-center", async (importOriginal) => ({ ...(await importOriginal<object>()), getControlCenter: mocks.report }));
import Page from "@/app/admin/control-center/page";
import { ControlCenterView } from "@/components/admin/control-center-view";
import { calculateFinance, type FinanceLedger } from "./control-center";
const fixture = (rows: FinanceLedger[] = []) => ({ status: "ready" as const, report: calculateFinance(rows, [], [], "all", "2026-10-25T12:00:00.000Z") });
function capture(name: string, html: string) { const dir = process.env.FREEARN_CONTROL_QA_DIR; if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${name}.html`, html);
} }
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "a", email: "admin@test.invalid" }); mocks.admin.mockReturnValue(true); mocks.report.mockResolvedValue({ status: "unavailable" }); });
it.each([null, { id: "u", email: "user@test.invalid" }])("page denies before loading financial report", async (user) => { mocks.user.mockResolvedValue(user); mocks.admin.mockReturnValue(false); await expect(Page({})).rejects.toThrow("404"); expect(mocks.report).not.toHaveBeenCalled(); });
it("forwards only a validated period to the server report", async () => { await Page({ searchParams: { period: "30" } }); expect(mocks.report).toHaveBeenCalledWith("30"); });
it("unavailable screen contains no invented financial zeros", () => { const html = renderToStaticMarkup(<ControlCenterView result={{ status: "unavailable" }} period="7"/>); expect(html).toContain("Not available"); expect(html).not.toContain("$0.00"); expect(html).toContain('aria-current="page"'); capture("unavailable", html); });
it("renders an honest empty state with source caveats and no payout actions", () => { const html = renderToStaticMarkup(<ControlCenterView result={fixture()} period="all"/>); expect(html).toContain("No confirmed positive survey or offer rewards"); expect(html).toContain("Reported revenue minus withdrawals is not profit"); expect(html).not.toMatch(/<form|<button/); capture("empty", html); });
it("renders real supplied cents, separates unknowns and withstands large totals", () => { const html = renderToStaticMarkup(<ControlCenterView result={fixture([{ id: "r", user_id: "u", type: "survey_reward", status: "confirmed", amount_cents: 123456789, publisher_revenue_cents: 200000000, provider: "cpx", provider_transaction_id: "tx", created_at: "2026-10-25T11:00:00.000Z" }])} period="all"/>); expect(html).toContain("$1,234,567.89"); expect(html).toContain("$2,000,000.00"); expect(html).toContain("Net profit"); expect(html).toContain("Not available"); capture("funded", html); });
