import { AdminNav } from "@/components/admin/admin-nav";
import { authorize } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

async function queueCounts() {
  if (!isSupabaseConfigured()) return { reports: 0, claims: 0, withdrawals: 0 };
  const db = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [r, c, w] = await Promise.all([
    db.from("reports").select("id", head).eq("status", "open"),
    db.from("copy_claims").select("id", head).eq("status", "open"),
    db.from("withdrawals").select("id", head).eq("status", "requested"),
  ]);
  return { reports: r.count ?? 0, claims: c.count ?? 0, withdrawals: w.count ?? 0 };
}

// Admin area (BLUEPRINT §13): desktop-first, a sidebar on wide screens and a scrolling menu on phones.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await authorize("admin.access");
  const counts = await queueCounts();
  return (
    <div className="mx-auto w-full max-w-[90rem] px-4 pb-16 pt-4 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <AdminNav counts={counts} />
      </aside>
      <div className="mt-4 min-w-0 lg:mt-0">{children}</div>
    </div>
  );
}
