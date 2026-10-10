import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/auth/home";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.login.title"), robots: { index: false } };
}

type As = "client" | "designer";

/** Keeps ?next= when moving between the two steps. */
function loginHref(as: As | null, next?: string) {
  const p = new URLSearchParams();
  if (as) p.set("as", as);
  if (next) p.set("next", next);
  const q = p.toString();
  return q ? `/login?${q}` : "/login";
}

function RoleIcon({ as }: { as: As }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {as === "client" ? (
        // a shop front
        <>
          <path d="M4 10v10h16V10" />
          <path d="M3 10l2-6h14l2 6c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3Z" />
          <path d="M10 20v-5h4v5" />
        </>
      ) : (
        // a pen nib
        <>
          <path d="M12 3l6 8-6 10-6-10Z" />
          <circle cx="12" cy="11" r="1.6" />
          <path d="M12 12.6V21" />
        </>
      )}
    </svg>
  );
}

// P-11 (owner, 2026-10-08): first "I'm a client" / "I'm a designer", then the form.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const current = await getCurrentUser();
  if (current) redirect(homeForRole(current.role));
  const { t } = await getI18n();
  const nextPath = typeof sp.next === "string" ? sp.next : undefined;
  const as: As | null = sp.as === "client" || sp.as === "designer" ? sp.as : null;

  // Admin links go to the admin sign-in page (owner, 2026-10-10): an admin is neither client nor designer.
  if (!as && (nextPath === "/admin" || nextPath?.startsWith("/admin/"))) redirect(`/admin-login?next=${encodeURIComponent(nextPath)}`);

  if (!as) {
    return (
      <AuthCard title={t("auth.login.title")} subtitle={t("auth.login.chooseSubtitle")}>
        <ul className="m-0 list-none space-y-3 p-0">
          {(["client", "designer"] as const).map((role) => (
            <li key={role}>
              <Link
                href={loginHref(role, nextPath)}
                className="group flex min-h-20 items-center gap-4 rounded-[20px] border border-line bg-surface p-4 transition-[border-color,box-shadow] hover:border-primary hover:shadow-card"
              >
                <span className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-tint text-primary">
                  <RoleIcon as={role} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold text-ink">{t(`auth.login.${role}.choice`)}</span>
                  <span className="block text-[15px] text-muted">{t(`auth.login.${role}.choiceLine`)}</span>
                </span>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={as === "designer" ? "pen" : "lock"}
      title={t(`auth.login.${as}.title`)}
      subtitle={t("auth.login.subtitle")}
      footer={
        <div className="flex flex-col items-center gap-1">
          <p>
            {t("auth.login.newHere")}{" "}
            <Link href={as === "client" ? "/start" : "/designers/signup"} className="font-bold text-primary hover:underline">
              {t(`auth.login.${as}.signup`)}
            </Link>
          </p>
          <Link href={loginHref(null, nextPath)} className="inline-flex min-h-11 items-center font-semibold text-muted hover:text-primary">
            {t(`auth.login.${as}.switch`)}
          </Link>
        </div>
      }
    >
      <LoginForm next={nextPath} />
    </AuthCard>
  );
}
