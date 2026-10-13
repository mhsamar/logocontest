import Link from "next/link";
import { PageShell, Panel } from "@/components/ui/panel";
import { getI18n } from "@/lib/i18n/server";
import { headStartLeft, opensToAllAt } from "@/lib/pro/rules";
import { getProSettings } from "@/lib/pro/settings";
import { durationText, Icon } from "./parts";
import "./pro.css";

/**
 * A brand-new contest in its Pro early-access window (owner, 2026-10-13): everyone who isn't Pro sees when it opens
 * to them, and a way to Go Pro while the plan is for sale.
 */
export async function EarlyAccessGate({ startsAt }: { startsAt: Date }) {
  const [{ t, locale }, { settings }] = await Promise.all([getI18n(), getProSettings()]);
  const minutes = headStartLeft(startsAt, settings);
  const at = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(opensToAllAt(startsAt, settings));
  return (
    <PageShell>
      <Panel className="flex flex-1 items-center justify-center">
        <div className="pr pr-gate">
          <span className="ic">
            <Icon name="clock" size={30} />
          </span>
          <h1>{t("pro.gate.title", { time: durationText(minutes, t) })}</h1>
          <p>{t("pro.gate.lead", { at })}</p>
          <div className="row">
            {settings.isForSale && (
              <Link href="/pro" className="pr-btn">
                <Icon name="crown" />
                {t("pro.gate.goPro")}
              </Link>
            )}
            <Link href="/contests" className="pr-out">
              {t("pro.gate.back")}
            </Link>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
