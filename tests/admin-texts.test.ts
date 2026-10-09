import { describe, expect, it } from "vitest";
import bn from "@/lib/i18n/messages/bn";
import en from "@/lib/i18n/messages/en";

// Admin keys built at run time (`admin.audit.actions.${action}` …) aren't checked by TypeScript, so check them here.
const AUDIT_ACTIONS = [
  "reveal_id_number", "resolve_copy_claim", "give_strike", "remove_strike", "suspend_user", "ban_user", "reactivate_user", "resolve_report",
  "cancel_contest", "extend_contest", "force_award", "edit_brief", "remove_entry", "clear_duplicate", "update_settings",
  "add_blocked_term", "remove_blocked_term", "feature_logo", "unfeature_logo", "mark_withdrawal_paid", "reject_withdrawal", "confirm_monthly_winner", "gift_sent",
];

describe("admin texts", () => {
  for (const [name, m] of [["en", en], ["bn", bn]] as const) {
    it(`${name}: every dynamic admin key has a text`, () => {
      const a = m.admin;
      for (const x of AUDIT_ACTIONS) expect(a.audit.actions[x as keyof typeof a.audit.actions], x).toBeTruthy();
      for (let i = 1; i <= 13; i++) expect(a.dashboard.steps[`s${i}` as keyof typeof a.dashboard.steps]).toBeTruthy();
      for (const x of ["active", "rejected", "withdrawn", "removed", "winner", "forfeited"]) expect(a.entries.statuses[x as keyof typeof a.entries.statuses]).toBeTruthy();
      for (const x of ["copied", "ai", "trademark", "contact_info", "inappropriate", "other"]) expect(a.reports.reasons[x as keyof typeof a.reports.reasons]).toBeTruthy();
      for (const x of ["fees", "packages", "upgrades", "timers", "limits", "monthly", "site", "auth"]) expect(a.settings.groups[x as keyof typeof a.settings.groups]).toBeTruthy();
      for (const x of ["phone", "number_words", "email", "handle", "link", "term"]) expect(a.terms.kinds[x as keyof typeof a.terms.kinds]).toBeTruthy();
    });
  }
});
