import { getI18n } from "@/lib/i18n/server";
import { backupOrigin, canonicalOrigin } from "@/lib/site-hosts";
import { backupLinksOn, requestOrigin } from "@/lib/site-origin";
import { BackToMainLink } from "./back-to-main-link";

const hostOf = (origin: string) => new URL(origin).host;

/**
 * The backup address (owner, 2026-10-21). Visitors on logocontestbd.com see that it is our backup and that it works
 * (with a link back to logocontest.bd once Backup links is off again). Admins anywhere see a reminder while Backup
 * links is on. Nothing shows on logocontest.bd for visitors.
 */
export async function BackupBar({ admin }: { admin: boolean }) {
  const backup = backupOrigin();
  if (!backup) return null;
  const [{ t }, here, on] = await Promise.all([getI18n(), requestOrigin(), backupLinksOn()]);
  const main = canonicalOrigin();
  const onBackup = here === backup;
  if (!onBackup && !(admin && on)) return null;
  return (
    <>
      {onBackup && (
        <div role="status" className="relative z-40 bg-[#FFF1CF] px-4 py-2.5 text-center text-sm leading-snug text-[#4A3700]">
          <span className="font-semibold">{t("backup.onBackup", { backup: hostOf(backup) })}</span> {t("backup.paid")}
          {!on && (
            <>
              {" "}
              <BackToMainLink main={main} label={t("backup.goBack", { main: hostOf(main) })} />
            </>
          )}
        </div>
      )}
      {admin && on && <div className="relative z-40 bg-[#8B0000] px-4 py-2 text-center text-sm font-semibold leading-snug text-white">{t("backup.adminOn", { backup: hostOf(backup), main: hostOf(main) })}</div>}
    </>
  );
}
