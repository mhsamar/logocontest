import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

export async function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-14">
      <div className="sm:rounded-lg sm:bg-surface sm:p-8 sm:shadow-card sm:ring-1 sm:ring-line">
        <h1 className="text-h1 font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
        {!isSupabaseConfigured() && (
          <div className="mt-5">
            <Alert tone="warning">{t("auth.errors.notConfigured")}</Alert>
          </div>
        )}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
