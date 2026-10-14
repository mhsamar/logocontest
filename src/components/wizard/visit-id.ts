/** One id per browser tab visit, so a reload continues the same visit (wizard drop-off and saved mobile numbers). */
export function wizardVisitId(): string {
  try {
    let id = sessionStorage.getItem("lc-wizard-visit");
    if (!id) sessionStorage.setItem("lc-wizard-visit", (id = crypto.randomUUID()));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
