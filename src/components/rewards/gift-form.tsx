"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PhoneField, TextAreaField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { saveGiftAddress } from "@/lib/rewards/actions";

/** The Monthly Winner's gift delivery details (owner, 2026-10-09). */
export function GiftForm({ month, initial }: { month: string; initial: { name: string; phone: string; address: string } }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await saveGiftAddress(month, v);
          if (!res.ok) return setError(t(res.error));
          toast(t("gift.saved"));
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <TextField label={t("gift.name")} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} autoComplete="name" required />
      <PhoneField label={t("gift.phone")} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} required />
      <TextAreaField label={t("gift.address")} hint={t("gift.addressHint")} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} maxLength={400} rows={3} required />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" block loading={busy}>
        {t("gift.save")}
      </Button>
    </form>
  );
}
