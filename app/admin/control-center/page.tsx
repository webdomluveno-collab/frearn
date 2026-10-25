import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, isAdminEmail } from "@/lib/auth/server";
import { financePeriod, getControlCenter } from "@/lib/admin/control-center";
import { ControlCenterView } from "@/components/admin/control-center-view";
export const metadata: Metadata = { title: "Control Center | Freearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function ControlCenterPage({ searchParams }: {
    searchParams?: {
        period?: string | string[];
    };
}) {
    const user = await getSessionUser();
    if (!user || !isAdminEmail(user.email))
        notFound();
    const period = financePeriod(searchParams?.period);
    const result = await getControlCenter(period);
    return <ControlCenterView result={result} period={period}/>;
}
