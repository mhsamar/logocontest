import { Alert } from "@/components/ui/alert";
import { PageShell, Panel } from "@/components/ui/panel";
import { IconBadge } from "@/components/ui/section-heading";
import { Svg } from "@/components/ui/svg";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { cx } from "@/lib/cx";

// Line icons for the top of the card.
export const AUTH_ICONS = {
  lock: "M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 017 0V11M12 15v2",
  key: "M14.5 9.5a4.5 4.5 0 11-1.3-3.2 4.5 4.5 0 011.3 3.2zM13.2 12.7L21 20.5M17.5 17l2-2M15.5 15l1.5-1.5",
  mail: "M3.5 6.5h17v11h-17zM4 7l8 6 8-6",
  pen: "M12 3l6 8-6 10-6-10zM12 12.6V21",
  shield: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4",
} as const;

/**
 * The sign-in pages' card in the site design (owner, 2026-10-10; UI-JOURNEY §1): a white card with a red
 * icon tile, centred on the light grey page panel. `wide` is for the longer designer sign-up.
 */
export async function AuthCard({
  title,
  subtitle,
  icon = "lock",
  wide = false,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof AUTH_ICONS;
  wide?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = await getI18n();
  return (
    <PageShell>
      <Panel tone="grey" className="flex flex-1 flex-col items-center justify-center max-[720px]:py-6">
        <div className={cx("lc-card lc-sh w-full p-6 sm:p-9", wide ? "max-w-xl" : "max-w-[30rem]")}>
          <IconBadge size="lg">
            <Svg d={AUTH_ICONS[icon]} size={26} stroke="#fff" width={1.9} />
          </IconBadge>
          <h1 className="m-0 mt-6 text-[clamp(28px,3.2vw,38px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{title}</h1>
          {subtitle && <p className="m-0 mt-2 text-[17px] leading-relaxed text-muted">{subtitle}</p>}
          {!isSupabaseConfigured() && (
            <div className="mt-5">
              <Alert tone="warning">{t("auth.errors.notConfigured")}</Alert>
            </div>
          )}
          <div className="mt-7">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-[15px] text-muted">{footer}</div>}
      </Panel>
    </PageShell>
  );
}
