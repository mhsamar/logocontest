import { LogoMark } from "@/components/ui/logo";
import { setLocale } from "@/lib/i18n/actions";
import { getI18n } from "@/lib/i18n/server";
import { AdminIcon, type AdminIconName } from "./icons";

/** Shared parts of the admin sign-in and signed-out pages (owner, 2026-10-10). */

/** "logocontest.bd  Admin" lockup. `light` is for the red band. */
export async function AdminLockup({ light = false }: { light?: boolean }) {
  const { t } = await getI18n();
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark inverted={light} className="size-9" />
      <span className={`lc-d text-[22px] font-semibold tracking-[-0.03em] ${light ? "text-white" : "text-ink"}`}>logocontest.bd</span>
      <span className={`rounded-[6px] px-2 py-0.5 text-xs font-bold ${light ? "bg-white/15 text-white" : "bg-[#f0f1f4] text-adm-strong"}`}>{t("admin.shell.brand")}</span>
    </span>
  );
}

/** English / বাংলা switch. */
export async function DoorLanguage({ light = false }: { light?: boolean }) {
  const { t, locale } = await getI18n();
  const other = locale === "bn" ? "en" : "bn";
  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={other} />
      <button type="submit" lang={other} aria-label={t("nav.switchToLabel")} className={`inline-flex h-10 items-center rounded-[10px] border px-3.5 text-sm font-bold ${light ? "border-white/30 text-white hover:bg-white/10" : "border-adm-line text-adm-strong hover:bg-adm-bg"}`}>
        {t("nav.switchTo")}
      </button>
    </form>
  );
}

function FloatCard({ icon, title, className, children }: { icon: AdminIconName; title: string; className: string; children: React.ReactNode }) {
  return (
    <div className={`absolute w-[176px] rounded-[16px] border border-adm-line bg-surface p-4 shadow-[0_18px_40px_rgb(17_18_22/0.10)] ${className}`}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-tint text-primary">
          <AdminIcon name={icon} size={16} />
        </span>
        <strong className="text-[15px]">{title}</strong>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * The picture beside the sign-in form: the brand mark in a soft circle with three admin cards around it.
 * The cards are drawings only (no numbers), so nothing on this public page looks like real figures.
 */
export async function DoorIllustration() {
  const { t } = await getI18n();
  return (
    <div aria-hidden className="relative mx-auto h-[440px] w-full max-w-[560px]">
      <div className="absolute left-1/2 top-1/2 size-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e3e4e8]" />
      <div className="absolute left-1/2 top-1/2 size-[290px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-tint/70" />
      <div className="absolute left-1/2 top-1/2 flex size-[148px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[40px] bg-[image:var(--gradient-red-dark)] shadow-[0_30px_60px_rgb(92_10_12/0.35)]">
        <LogoMark inverted className="size-20" />
      </div>

      <FloatCard icon="contests" title={t("admin.doors.cards.contests")} className="left-0 top-10 -rotate-3">
        <svg viewBox="0 0 140 44" className="h-11 w-full">
          <polyline points="2,38 26,26 46,32 70,14 92,22 116,6 138,10" fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[2, 26, 46, 70, 92, 116].map((x, i) => (
            <circle key={x} cx={x} cy={[38, 26, 32, 14, 22, 6][i]} r="3.5" fill="#fff" stroke="var(--color-primary)" strokeWidth="2" />
          ))}
        </svg>
      </FloatCard>

      <FloatCard icon="designs" title={t("admin.doors.cards.designs")} className="right-0 top-24 rotate-2">
        <div className="grid grid-cols-3 gap-1.5">
          {["bg-primary", "bg-ink", "bg-gold", "bg-tint", "bg-adm-pay", "bg-primary/60", "bg-[#d9e6f7]", "bg-adm-addon", "bg-[#f0f1f4]"].map((c, i) => (
            <span key={i} className={`aspect-square rounded-[8px] ${c}`} />
          ))}
        </div>
      </FloatCard>

      <FloatCard icon="payments" title={t("admin.doors.cards.payments")} className="bottom-6 left-10 rotate-1">
        <div className="flex h-11 items-end gap-1.5">
          {[40, 65, 30, 80, 55, 95, 70].map((h, i) => (
            <span key={i} className="flex-1 rounded-t-[4px] bg-adm-pay" style={{ height: `${h}%`, opacity: 0.45 + i * 0.08 }} />
          ))}
        </div>
      </FloatCard>
    </div>
  );
}
