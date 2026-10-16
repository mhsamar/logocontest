import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { oldMyContestsLink } from "@/lib/client/rules";

// P-14 My contests moved into the premium client workspace (owner, 2026-10-16): /client/contests, same tab, sort and
// search. Old links, bookmarks and the site menu keep working.
export default async function MyContestsPage({ searchParams }: PageProps<"/my-contests">) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent("/client/contests")}`);
  if (user.role !== "client") redirect("/contests");
  redirect(oldMyContestsLink(await searchParams));
}
