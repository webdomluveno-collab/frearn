import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, isAdminEmail } from "@/lib/auth/server";
import { getUserEarningsPage } from "@/lib/admin/user-earnings";
import { UsersEarningsView } from "@/components/admin/users-earnings-view";

export const metadata: Metadata = {
  title: "Users & earnings | Freearn Admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsersAndEarningsPage({ searchParams }: {
  searchParams?: { q?: string | string[]; sort?: string | string[]; page?: string | string[] };
}) {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const report = await getUserEarningsPage({
    query: searchParams?.q,
    sort: searchParams?.sort,
    page: searchParams?.page,
  });
  return <UsersEarningsView report={report} />;
}
