import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { EmailVerificationService, type VerificationRecord, type VerificationRepository } from "@/lib/auth/email-verification";
import { CATALOG, chatEmailDue, digestDue, digestTime, EMAIL_KEYS, parseEmailOff, parseTierOff, SETTINGS_KEYS, shouldSend, spanText, tierAllows, userMayStop, type EmailKey } from "@/lib/email/catalog";
import { imageToken, readImageToken, unsubscribeOk, unsubscribeQuery, unsubscribeSig } from "@/lib/email/links";
import { bodyHtml, escapeHtml, htmlToText, previewOf, render, type EmailData } from "@/lib/email/render";
import { TEMPLATES } from "@/lib/email/templates";
import { SETTINGS } from "@/lib/settings/registry";

const SITE = "https://logocontest.bd";
const SHARED: EmailData = {
  site_url: SITE,
  logo_url: `${SITE}/brand/logo-icon-tile.png`,
  settings_url: `${SITE}/dashboard/profile#emails`,
  help_url: `${SITE}/help`,
  unsubscribe_url: `${SITE}/email/unsubscribe?u=1&k=x&s=y`,
  company_address: "Dhaka, Bangladesh",
  email: "rahim@example.com",
  first_name: "Rahim",
};

// Sample data for every email: each variable it uses has a value.
const SAMPLE: Record<EmailKey, EmailData> = {
  otp: { otp_code: "482913", otp_minutes: 10, otp_purpose: "confirm your email" },
  welcome: { dashboard_url: `${SITE}/dashboard` },
  "contest-new": { contest_title: "Rahim Foods", contest_type: "Logo design", prize: "5,000", end_date: "16 Oct 2026, 9:00 pm", contest_url: `${SITE}/contest/rahim-foods`, contest_image_url: `${SITE}/api/email/contest/rahim-foods`, pro: true, head_start: "2 hours" },
  "contest-invite": { client_name: "Rahim Foods", contest_title: "Rahim Foods", contest_type: "Logo design", prize: "5,000", end_date: "16 Oct 2026", contest_url: `${SITE}/contest/x`, contest_image_url: `${SITE}/api/email/contest/x`, reminder_time: "24 hours" },
  "contest-ending": { hours_left: "6 hours", contest_title: "Rahim Foods", contest_type: "Logo design", prize: "5,000", end_date: "16 Oct 2026", entry_count: 14, my_entry_count: 2, contest_url: `${SITE}/contest/x/submit`, contest_image_url: `${SITE}/api/email/contest/x` },
  "entry-shortlisted": { entry_no: 7, contest_title: "Rahim Foods", entry_image_url: `${SITE}/api/email/image/abc.def`, contest_url: `${SITE}/contest/x?tab=entries&entry=7` },
  "contest-won": { entry_no: 7, contest_title: "Rahim Foods", entry_image_url: `${SITE}/api/email/image/abc.def`, prize: "5,000", fee_percent: 15, fee_amount: "750", payout_amount: "4,250", handover_url: `${SITE}/dashboard/handover/x` },
  "client-new-entries": { new_count: 3, contest_title: "Rahim Foods", entry_1_image_url: `${SITE}/i/1`, entry_2_image_url: `${SITE}/i/2`, entry_3_image_url: `${SITE}/i/3`, entry_count: 21, checked_count: 4, end_date: "16 Oct 2026", contest_url: `${SITE}/dashboard/contests/x` },
  "client-pick-winner": { contest_title: "Rahim Foods", contest_type: "Logo design", prize: "5,000", end_date: "16 Oct 2026", entry_count: 21, pick_days: 7, contest_url: `${SITE}/dashboard/contests/x`, contest_image_url: `${SITE}/api/email/contest/x` },
  "chat-message": { sender_name: "Karim", contest_title: "Rahim Foods", entry_no: 7, message_preview: "Can you try a darker red?", chat_url: `${SITE}/dashboard/messages?entry=1` },
  "logo-check-ready": { match_level: "No close match", match_percent: 12, file_name: "your logo", report_id: "CC-0042", checked_at: "15 Oct 2026, 2:10 pm", checks_left: "98", report_url: `${SITE}/dashboard/logo-checks` },
  "pro-receipt": { receipt_no: "PRO-000123", amount: "499", payment_method: "bKash", period_end: "15 Nov 2026", dashboard_url: `${SITE}/dashboard` },
  "pro-renewal": { days_left: 7, period_end: "22 Oct 2026", amount: "499", checks_used: 12, checks_limit: 100, wins_month: 1, renew_url: `${SITE}/pro/checkout?renew=1`, manage_url: `${SITE}/dashboard/profile#subscription` },
  "contest-reminder": { title: "Your contest is saved — finish in 1 minute", body: "Your Sample Tea contest is saved.\nFinish here: https://logocontest.bd/client/contests/x", preview: "Your Sample Tea contest is saved.", button_text: "Finish my contest", button_url: `${SITE}/client/contests/x` },
  notification: { title: "Your prize was released", body: "Your prize of ৳4,250 is in your wallet.\nWithdraw any time.", preview: "Your prize is in your wallet.", button_text: "Open wallet", button_url: `${SITE}/dashboard/wallet` },
};

const EVIL = `<script>alert(1)</script>"><img src=x onerror=alert(2)>{{otp_code}}`;

describe("email templates (owner, 2026-10-15)", () => {
  it.each(EMAIL_KEYS)("%s renders with its data: nothing left unfilled, a plain-text version, the safety line", (key) => {
    const mail = render(key, { ...SHARED, ...SAMPLE[key] });
    for (const part of [mail.subject, mail.html, mail.text]) {
      expect(part).not.toMatch(/\{\{|\}\}/);
      expect(part.length).toBeGreaterThan(0);
    }
    expect(mail.html).toContain(`<title>${escapeHtml(mail.subject)}</title>`);
    expect(mail.html).toContain(SHARED.logo_url);
    expect(mail.text).not.toMatch(/<[a-z/][^>]*>/i);
    expect(mail.text).toContain("We never ask for your password, OTP or payment details by email.");
  });

  it("every variable a template uses has sample data (so the test above really fills them all)", () => {
    for (const key of EMAIL_KEYS) {
      const used = new Set([...`${TEMPLATES[key]}${CATALOG[key].subject}${CATALOG[key].preheader}`.matchAll(/\{\{\{?#?(?:if )?(\w+)\}?\}\}/g)].map((m) => m[1]));
      for (const v of ["subject", "preheader", "body_html", "unsubscribe_url", "first_name"]) used.delete(v);
      const have = new Set(Object.keys({ ...SHARED, ...SAMPLE[key] }));
      expect([...used].filter((v) => !have.has(v)), key).toEqual([]);
    }
  });

  it.each(EMAIL_KEYS)("%s escapes people's text: no HTML and no variables can be slipped in", (key) => {
    const data: EmailData = { ...SHARED };
    for (const [k, v] of Object.entries(SAMPLE[key])) data[k] = typeof v === "string" && !/_url$/.test(k) ? EVIL : v;
    data.first_name = EVIL;
    const mail = render(key, data);
    expect(mail.html).not.toContain("<script");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("482913");
    expect(mail.html).not.toMatch(/\{\{/);
  });

  it("subjects and preview lines are filled from the catalog", () => {
    expect(render("otp", { ...SHARED, ...SAMPLE.otp }).subject).toBe("482913 is your logocontest.bd code");
    expect(render("contest-new", { ...SHARED, ...SAMPLE["contest-new"] }).subject).toBe("New contest: Rahim Foods · ৳5,000");
    expect(render("otp", { ...SHARED, ...SAMPLE.otp }).html).toContain("Your code works for 10 minutes. Do not share it.");
    // A subject is one line, whatever the data.
    expect(render("chat-message", { ...SHARED, ...SAMPLE["chat-message"], sender_name: "Karim\nBcc: x@y.z" }).subject).toBe("Karim Bcc: x@y.z sent you a message");
  });

  it("optional parts: the Pro note, pictures, the button, the entry number and Unsubscribe", () => {
    const pro = render("contest-new", { ...SHARED, ...SAMPLE["contest-new"] }).html;
    const basic = render("contest-new", { ...SHARED, ...SAMPLE["contest-new"], pro: false }).html;
    expect(pro).toContain("Pro early access");
    expect(pro).toContain("2 hours");
    expect(basic).not.toContain("Pro early access");
    expect(render("entry-shortlisted", { ...SHARED, ...SAMPLE["entry-shortlisted"], entry_image_url: "" }).html).not.toContain('<img src=""');
    expect(render("notification", { ...SHARED, ...SAMPLE.notification, button_text: "" }).html).not.toContain(SAMPLE.notification.button_url as string);
    expect(render("chat-message", { ...SHARED, ...SAMPLE["chat-message"], entry_no: "" }).html).not.toContain("entry #");
    // Codes and security emails have no Unsubscribe link.
    expect(render("otp", { ...SHARED, ...SAMPLE.otp, unsubscribe_url: "" }).html).not.toContain(">Unsubscribe<");
    expect(render("welcome", { ...SHARED, ...SAMPLE.welcome }).html).toContain(">Unsubscribe<");
  });

  it("the plain-text version has the rows, the button's link and the money", () => {
    const won = render("contest-won", { ...SHARED, ...SAMPLE["contest-won"] }).text;
    expect(won).toContain("Prize: ৳5,000");
    expect(won).toContain("Fee (15%): − ৳750");
    expect(won).toContain("You get: ৳4,250");
    expect(won).toContain(`Upload final files: ${SITE}/dashboard/handover/x`);
    const otp = render("otp", { ...SHARED, ...SAMPLE.otp }).text;
    expect(otp).toContain("482913");
    expect(otp).not.toMatch(/https?:\/\/\S*482913/);
    expect(htmlToText('<p>a &amp; b&nbsp;c</p><br><a href="https://x.y/?a=1&amp;b=2">Go</a>')).toBe("a & b c\n\nGo: https://x.y/?a=1&b=2");
  });

  it("a notification keeps its lines and makes only this site's links clickable", () => {
    const html = bodyHtml("Hi Rahim,\nSee https://logocontest.bd/dashboard/wallet.\nNot https://evil.example/x", SITE);
    expect(html).toContain('<a href="https://logocontest.bd/dashboard/wallet"');
    expect(html).toContain("wallet</a>.");
    expect(html).not.toContain('href="https://evil.example');
    expect(html.split("<br>")).toHaveLength(3);
    expect(previewOf("Hi Rahim,\n\nYour prize is ready.")).toBe("Your prize is ready.");
    expect(previewOf("প্রিয় রহিম,\n\nআপনার পুরস্কার তৈরি।")).toBe("আপনার পুরস্কার তৈরি।");
  });

  it("the code matches the designs in Design/emails/templates.json", () => {
    const file = path.join(process.cwd(), "Design/emails/templates.json");
    if (!existsSync(file)) return;
    const design = JSON.parse(readFileSync(file, "utf8")) as { key: EmailKey; subject: string; preheader: string }[];
    expect(design.map((d) => d.key).sort()).toEqual([...EMAIL_KEYS].sort());
    for (const d of design) {
      expect(CATALOG[d.key].subject).toBe(d.subject);
      // pro-renewal: the monthly logo checks come from Admin › Pro plan instead of a fixed 100.
      expect(CATALOG[d.key].preheader).toBe(d.preheader.replace("100 logo checks", "{{checks_limit}} logo checks"));
    }
  });
});

describe("who gets which email", () => {
  // Owner, 2026-10-31: only the new-designs email and the prize claim reminders can be stopped by the person.
  it("codes and security emails always go; a person can stop only the new-designs email and the claim reminders", () => {
    expect(shouldSend("otp", ["otp", "notification"])).toBe(true);
    expect(shouldSend("notification", ["notification"], true)).toBe(true);
    expect(shouldSend("notification", ["notification"])).toBe(true);
    expect(shouldSend("notification", ["notification"], false, "monthly_claim_reminder")).toBe(false);
    expect(shouldSend("notification", ["notification"], true, "monthly_claim_reminder")).toBe(true);
    expect(shouldSend("client-new-entries", ["client-new-entries"])).toBe(false);
    expect(shouldSend("contest-won", ["contest-won"])).toBe(true);
    expect(shouldSend("chat-message", ["chat-message"])).toBe(true);
    expect(userMayStop("client-new-entries")).toBe(true);
    expect(userMayStop("pro-receipt")).toBe(false);
    expect(parseEmailOff(["chat-message", "otp", "nonsense", 3, "chat-message"])).toEqual(["chat-message"]);
    expect(parseEmailOff(null)).toEqual([]);
    expect(SETTINGS_KEYS.designer).not.toContain("otp");
    expect(SETTINGS_KEYS.client).not.toContain("contest-new");
  });

  // Owner, 2026-10-31: every day at 7 pm Bangladesh time, with every design since the last one.
  it("the new-designs digest goes once a day from 7 pm Bangladesh time, and only with something new", () => {
    const at = (iso: string) => new Date(iso);
    // 6:59 pm in Dhaka (12:59 UTC): not yet.
    expect(digestDue(null, 4, at("2026-10-15T12:59:00Z"))).toBe(false);
    // 7 pm and later the same evening: once.
    expect(digestTime(at("2026-10-15T13:20:00Z")).toISOString()).toBe("2026-10-15T13:00:00.000Z");
    expect(digestDue(null, 4, at("2026-10-15T13:00:00Z"))).toBe(true);
    expect(digestDue(at("2026-10-14T13:05:00Z"), 2, at("2026-10-15T13:15:00Z"))).toBe(true);
    expect(digestDue(at("2026-10-15T13:05:00Z"), 2, at("2026-10-15T13:30:00Z"))).toBe(false);
    // After midnight in Dhaka (18:30 UTC = 0:30 am) it waits for that evening.
    expect(digestDue(at("2026-10-15T13:05:00Z"), 2, at("2026-10-15T18:30:00Z"))).toBe(false);
    expect(digestDue(at("2026-10-15T13:05:00Z"), 0, at("2026-10-16T13:30:00Z"))).toBe(false);
    // Another hour from Admin › Notifications.
    expect(digestDue(null, 1, at("2026-10-15T03:00:00Z"), 9)).toBe(true);
    expect(digestDue(null, 1, at("2026-10-15T02:59:00Z"), 9)).toBe(false);
  });

  it("chat emails: at most one per conversation every 30 minutes", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(chatEmailDue(null, now)).toBe(true);
    expect(chatEmailDue(new Date(now.getTime() - 29 * 60_000), now)).toBe(false);
    expect(chatEmailDue(new Date(now.getTime() - 30 * 60_000), now)).toBe(true);
  });

  it("spans read naturally", () => {
    expect(spanText(30)).toBe("30 minutes");
    expect(spanText(60)).toBe("1 hour");
    expect(spanText(120)).toBe("2 hours");
    expect(spanText(72 * 60)).toBe("3 days");
  });
});

describe("signed links", () => {
  it("an Unsubscribe link works only for its person and its kind of email", () => {
    const sig = unsubscribeSig("secret", "u1", "chat-message");
    expect(unsubscribeOk("secret", "u1", "chat-message", sig)).toBe(true);
    expect(unsubscribeOk("secret", "u2", "chat-message", sig)).toBe(false);
    expect(unsubscribeOk("secret", "u1", "contest-new", sig)).toBe(false);
    expect(unsubscribeOk("other", "u1", "chat-message", sig)).toBe(false);
    expect(unsubscribeQuery("secret", "u1", "chat-message")).toBe(`u=u1&k=chat-message&s=${sig}`);
  });

  it("a picture link can't be changed and runs out", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    const t = { bucket: "entry-files", path: "previews/c/e/1-x.jpg", width: 600, exp: Math.floor(now.getTime() / 1000) + 3600 };
    const token = imageToken("secret", t);
    expect(readImageToken("secret", token, now)).toEqual(t);
    expect(readImageToken("other", token, now)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify(["entry-files", "originals/secret.png", 600, t.exp])).toString("base64url");
    expect(readImageToken("secret", `${forged}.${sig}`, now)).toBeNull();
    expect(readImageToken("secret", `${body}.${sig}`, new Date(now.getTime() + 2 * 3_600_000))).toBeNull();
    expect(readImageToken("secret", "garbage", now)).toBeNull();
  });
});

// Codes (owner, 2026-10-15): 6 digits, 10 minutes, 5 tries, a wait before resending — the defaults in Settings.
class MemoryRepo implements VerificationRepository {
  rows: VerificationRecord[] = [];
  constructor(private readonly clock: () => Date) {}
  async create(r: Pick<VerificationRecord, "userId" | "email" | "codeHash" | "expiresAt">) {
    this.rows.push({ ...r, id: String(this.rows.length + 1), attempts: 0, usedAt: null, createdAt: this.clock() });
  }
  async latest(userId: string) {
    return this.rows.filter((r) => r.userId === userId).at(-1) ?? null;
  }
  async incrementAttempts(id: string) {
    return ++this.rows.find((x) => x.id === id)!.attempts;
  }
  async markUsed(id: string, at: Date) {
    const r = this.rows.find((x) => x.id === id)!;
    if (r.usedAt) return false;
    r.usedAt = at;
    return true;
  }
  async markEmailVerified() {}
}

describe("email codes with the default settings", () => {
  const config = {
    length: SETTINGS["auth.email_code_length"].default,
    ttlMinutes: SETTINGS["auth.email_code_ttl_minutes"].default,
    maxAttempts: SETTINGS["auth.email_code_max_attempts"].default,
    resendSeconds: SETTINGS["auth.email_code_resend_seconds"].default,
  };
  let now: Date;
  let service: EmailVerificationService;
  beforeEach(() => {
    now = new Date("2026-10-15T10:00:00Z");
    service = new EmailVerificationService({ repo: new MemoryRepo(() => now), secret: "s", config: async () => config, now: () => now });
  });

  it("are 6 digits and work for 10 minutes", async () => {
    expect(config).toEqual({ length: 6, ttlMinutes: 10, maxAttempts: 5, resendSeconds: 60 });
    const issued = await service.issue("u1", "a@b.com");
    if (!issued.ok) throw new Error("not issued");
    expect(issued.code).toMatch(/^\d{6}$/);
    now = new Date(now.getTime() + 9 * 60_000);
    expect(await service.verify("u1", "000000")).toMatchObject({ ok: false, error: issued.code === "000000" ? undefined : "invalid" });
    now = new Date(now.getTime() + 60_000);
    expect(await service.verify("u1", issued.code)).toEqual({ ok: false, error: "expired" });
  });

  it("lock after 5 wrong tries, and a new code needs a wait", async () => {
    const issued = await service.issue("u1", "a@b.com");
    if (!issued.ok) throw new Error("not issued");
    const wrong = issued.code === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) await service.verify("u1", wrong);
    expect(await service.verify("u1", issued.code)).toEqual({ ok: false, error: "too_many_attempts" });
    expect(await service.issue("u1", "a@b.com")).toMatchObject({ ok: false, error: "cooldown" });
  });
});

describe("designer emails by plan (owner, 2026-10-15)", () => {
  it("the owner's switches are cleaned: designer emails only, no repeats", () => {
    expect(parseTierOff({ basic: ["contest-invite", "contest-invite", "otp", "client-new-entries", "nope"], pro: "x" })).toEqual({ basic: ["contest-invite"], pro: [] });
    expect(parseTierOff(null)).toEqual({ basic: [], pro: [] });
    // Owner, 2026-10-31: new contests by email go to Pro designers only.
    expect(SETTINGS["notifications.designer_emails"].default).toEqual({ basic: ["contest-new"], pro: [] });
  });

  it("each plan gets only the emails that are on for it; other emails are not touched", () => {
    const off = parseTierOff({ basic: ["contest-invite", "pro-renewal"], pro: ["contest-new"] });
    expect(tierAllows(off, "basic", "contest-invite")).toBe(false);
    expect(tierAllows(off, "pro", "contest-invite")).toBe(true);
    expect(tierAllows(off, "pro", "contest-new")).toBe(false);
    expect(tierAllows(off, "basic", "contest-new")).toBe(true);
    // Not designer emails: never stopped by these switches.
    expect(tierAllows(off, "basic", "otp")).toBe(true);
    expect(tierAllows(off, "basic", "welcome")).toBe(true);
    expect(tierAllows(off, "basic", "client-new-entries")).toBe(true);
  });
});
