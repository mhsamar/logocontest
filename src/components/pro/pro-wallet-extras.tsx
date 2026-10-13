import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { receiptCode } from "@/lib/pro/rules";
import type { WalletTx } from "@/lib/wallet/queries";
import { Icon } from "./parts";

/**
 * Pro › Wallet extras (owner, 2026-10-13; Design/pro/pro-wallet.html): earnings by month (prize money after the fee,
 * last 6 months) and the Pro receipts, each as a PDF.
 */
export async function ProWalletExtras({ designerId, transactions }: { designerId: string; transactions: WalletTx[] }) {
  const { t, locale } = await getI18n();
  const { data: pays } = await createAdminClient().from("pro_payments").select("id, amount_bdt, receipt_no, paid_at").eq("designer_id", designerId).eq("status", "paid").order("paid_at", { ascending: false }).limit(24);
  const months: { key: string; label: string; amount: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    months.push({ key: d.toISOString().slice(0, 7), label: new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", timeZone: "UTC" }).format(d), amount: 0 });
  }
  for (const tx of transactions) {
    if (tx.type !== "prize_credit" && tx.type !== "split_share") continue;
    const m = months.find((x) => x.key === new Date(tx.createdAt.getTime() + 6 * 3_600_000).toISOString().slice(0, 7));
    if (m) m.amount += tx.amount;
  }
  const max = Math.max(1, ...months.map((m) => m.amount));
  return (
    <div className="pr-g2">
      <section className="pr-card" aria-labelledby="pw-earn">
        <div className="pr-ch">
          <h2 id="pw-earn">{t("pro.wallet.earnings")}</h2>
        </div>
        <p className="pr-hint">{t("pro.wallet.earningsHint")}</p>
        {months.every((m) => m.amount === 0) ? (
          <p className="pr-empty">{t("pro.wallet.noEarnings")}</p>
        ) : (
          <div className="pr-bars" style={{ gap: 12 }} role="img" aria-label={t("pro.wallet.earnings")}>
            {months.map((m) => (
              <span key={m.key} className="d" title={`${m.label}: ${formatTaka(m.amount, locale)}`} style={{ alignItems: "center" }}>
                <i className="m" style={{ height: `${(m.amount / max) * 85}%`, borderRadius: 8 }} />
                <em style={{ fontStyle: "normal", fontSize: 12, fontWeight: 700, color: "#5F626B", marginTop: 6 }}>{m.label}</em>
              </span>
            ))}
          </div>
        )}
      </section>
      <section className="pr-card" id="receipts" aria-labelledby="pw-rec" style={{ scrollMarginTop: 120 }}>
        <div className="pr-ch">
          <h2 id="pw-rec">{t("pro.wallet.receipts")}</h2>
        </div>
        {(pays ?? []).length === 0 && <p className="pr-empty">{t("pro.wallet.noReceipts")}</p>}
        {(pays ?? []).map((p) => (
          <div key={p.id as string} className="pr-li">
            <span className="pr-ic g">
              <Icon name="crown" />
            </span>
            <div>
              <b>
                {t("pro.wallet.proPlan")} · {receiptCode(p.receipt_no as number)}
              </b>
              <em>
                {formatDate(new Date(p.paid_at as string), locale, "long")} · {t("pro.wallet.monthly")}
              </em>
            </div>
            <b>{formatTaka(p.amount_bdt as number, locale)}</b>
            <a href={`/api/pro/receipt/${p.id}`} className="pr-out sm" target="_blank" rel="noopener">
              {t("pro.wallet.pdf")}
            </a>
          </div>
        ))}
      </section>
    </div>
  );
}
