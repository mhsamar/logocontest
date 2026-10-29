/** One id per browser tab visit, so a reload continues the same visit (wizard drop-off and saved mobile numbers). */
export function wizardVisitId(flow: "v1" | "v2" = "v1"): string {
  // Onboarding v2 (owner, 2026-10-28) has its own, so a tab that opens both wizards counts two visits.
  const key = flow === "v2" ? "lc-wizard-visit-v2" : "lc-wizard-visit";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) sessionStorage.setItem(key, (id = crypto.randomUUID()));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
