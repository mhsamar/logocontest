import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { myLatestRewardId } from "@/lib/rewards/claims";

// The old Monthly Winner gift page (owner, 2026-10-09) is replaced by the monthly prize page (2026-10-11).
export default async function GiftPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const id = await myLatestRewardId(user.id);
  redirect(id ? `/dashboard/rewards/${id}` : "/dashboard");
}
