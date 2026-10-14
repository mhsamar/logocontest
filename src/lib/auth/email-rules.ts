/**
 * Real emails only (owner, 2026-10-14): no made-up addresses like "de@gmail.com" or "xyz@…", and no temporary
 * (throwaway) inboxes. Pure: used at sign-up and when the email is changed, and by the tests. The DNS part (does the
 * domain take mail, does it have a website) is in ./email-check.ts.
 */

export type EmailProblem = { kind: "fake" } | { kind: "disposable" } | { kind: "typo"; suggestion: string };

/** Big free providers: their own rules for the name part, and no DNS look-up needed. */
const PROVIDERS: Record<string, { min: number; max: number }> = {
  "gmail.com": { min: 6, max: 30 },
  "googlemail.com": { min: 6, max: 30 },
  "yahoo.com": { min: 4, max: 32 },
  "ymail.com": { min: 4, max: 32 },
  "outlook.com": { min: 3, max: 64 },
  "hotmail.com": { min: 3, max: 64 },
  "live.com": { min: 3, max: 64 },
  "msn.com": { min: 3, max: 64 },
  "icloud.com": { min: 3, max: 64 },
  "me.com": { min: 3, max: 64 },
  "proton.me": { min: 3, max: 40 },
  "protonmail.com": { min: 3, max: 40 },
  "aol.com": { min: 3, max: 32 },
  "yandex.com": { min: 3, max: 30 },
  "zoho.com": { min: 3, max: 64 },
};

export const isKnownProvider = (domain: string): boolean => domain in PROVIDERS;

/** Names people type when they don't want to give their email. */
const PLACEHOLDER_NAMES = new Set([
  "test", "tests", "testing", "tester", "abc", "abcd", "abcde", "abcdef", "xyz", "xyzz", "asd", "asdf", "asdfg", "asdfgh", "qwe", "qwer", "qwert", "qwerty",
  "example", "sample", "demo", "fake", "none", "noemail", "nomail", "no", "null", "nil", "na", "yourname", "youremail", "abc123", "test123", "123", "1234",
  "12345", "123456", "1234567", "12345678", "123456789", "xxx", "xxxx",
]);
/** Fine on a business's own domain (info@brand.com), made up on a free provider (email@gmail.com). */
const PROVIDER_PLACEHOLDERS = new Set(["user", "username", "email", "mail", "name", "admin", "info", "contact", "myemail", "mymail"]);

const PLACEHOLDER_DOMAINS = new Set(["example.com", "example.org", "example.net", "test.com", "test.org", "testing.com", "domain.com", "yourdomain.com", "mydomain.com", "company.com", "xyz.com", "abc.com", "asdf.com", "fake.com", "none.com", "email.example", "localhost"]);

/** Common misspellings of the big providers. */
const TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com", "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "gmaill.com": "gmail.com", "gmil.com": "gmail.com",
  "gnail.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gmail.cmo": "gmail.com",
  "gmail.comm": "gmail.com", "gmeil.com": "gmail.com", "gimal.com": "gmail.com", "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com", "yhoo.com": "yahoo.com", "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com", "hotmil.com": "hotmail.com", "outlok.com": "outlook.com", "outllok.com": "outlook.com", "outlook.co": "outlook.com",
  "iclod.com": "icloud.com", "icloud.co": "icloud.com",
};

/**
 * Well-known temporary-inbox sites. Admin › Settings › "Blocked email domains" adds more without a code change, and
 * an unknown domain with no website is caught by the DNS check.
 */
const DISPOSABLE = new Set([
  "mailinator.com", "mailinator.net", "mailinator2.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamail.de",
  "guerrillamail.info", "guerrillamailblock.com", "sharklasers.com", "grr.la", "pokemail.net", "spam4.me", "10minutemail.com", "10minutemail.net", "10minutemail.co.uk",
  "10minutesmail.com", "20minutemail.com", "temp-mail.org", "temp-mail.io", "temp-mail.ru", "tempmail.com", "tempmail.net", "tempmail.plus", "tempmailo.com",
  "tempail.com", "tempr.email", "tempinbox.com", "tempemail.net", "temporary-mail.net", "discard.email", "discardmail.com", "discardmail.de", "throwawaymail.com",
  "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf", "trashmail.com", "trashmail.de", "trashmail.net", "trashmail.io", "mytrashmail.com",
  "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com", "mintemail.com", "mohmal.com", "moakt.com", "moakt.cc", "emailondeck.com",
  "fakeinbox.com", "fakemail.net", "fakemailgenerator.com", "mailcatch.com", "mytemp.email", "burnermail.io", "spamgourmet.com", "mail.tm", "mail.gw",
  "inboxkitten.com", "emailfake.com", "generator.email", "33mail.com", "mailpoof.com", "linshiyouxiang.net", "tmail.ws", "tmpmail.org", "tmpmail.net",
  "1secmail.com", "1secmail.org", "1secmail.net", "esiix.com", "wwjmp.com", "xojxe.com", "yoggm.com", "kzccv.com", "qiott.com", "vjuum.com", "laafd.com",
  "txcct.com", "rteet.com", "dpptd.com", "mailto.plus", "fexpost.com", "fexbox.org", "fextemp.com", "mailbox.in.ua", "rover.info", "chitthi.in", "any.pink",
  "firemailbox.club", "inboxbear.com", "harakirimail.com", "spambox.us", "emailtemporanea.net", "crazymailing.com", "mailforspam.com", "spamfree24.org",
  "jetable.org", "mt2015.com", "mailexpire.com", "incognitomail.org", "anonbox.net", "mvrht.net", "dropmail.me", "10mail.org", "emltmp.com", "spymail.one",
  "tmails.net", "mailsac.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com",
  "teleworm.us", "armyspy.com", "getairmail.com", "airmail.cc", "mail-temp.com", "temp-mail.com", "tempmailaddress.com", "emailnax.com", "smailpro.com",
  "byom.de", "trbvm.com", "mailinater.com", "spamdecoy.net", "deadaddress.com", "mailmetrash.com", "throwam.com", "luxusmail.org", "minuteinbox.com",
  "tempmail.dev", "emailtmp.com", "tempmailer.com", "tempm.com", "mail7.io", "guerrillamail.cc", "nowmymail.com", "boximail.com", "zetmail.com",
  "vomoto.com", "ezztt.com", "dcctb.com", "bheps.com", "ruutukf.com", "backyr.com",
]);

/** "Name@Domain" lower-cased; null when there is no "@". */
export function splitEmail(email: string): { name: string; domain: string } | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return { name: email.slice(0, at).toLowerCase(), domain: email.slice(at + 1).toLowerCase() };
}

/** The extra blocked domains from Admin › Settings: one per line or comma separated, "@" and spaces ignored. */
export function parseDomainList(text: string): Set<string> {
  return new Set(
    text
      .split(/[\s,;]+/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)),
  );
}

/** A domain or any domain above it is in the list ("x.mailinator.com" counts as "mailinator.com"). */
export function inDomainList(domain: string, list: Set<string>): boolean {
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (list.has(parts.slice(i).join("."))) return true;
  return false;
}

/** What is wrong with this (already lower-cased, well-formed) email, without looking anything up; null when fine. */
export function emailProblem(email: string, opts: { blocked?: Set<string>; allowed?: Set<string> } = {}): EmailProblem | null {
  const parts = splitEmail(email);
  if (!parts) return { kind: "fake" };
  const { domain } = parts;
  // "name+tag@" and Gmail's dots don't change the inbox.
  const base = parts.name.split("+")[0];
  const bare = base.replace(/\./g, "");
  if (opts.allowed && inDomainList(domain, opts.allowed)) return null;
  if (TYPOS[domain]) return { kind: "typo", suggestion: `${parts.name}@${TYPOS[domain]}` };
  if (PLACEHOLDER_DOMAINS.has(domain)) return { kind: "fake" };
  if (inDomainList(domain, DISPOSABLE) || (opts.blocked && inDomainList(domain, opts.blocked))) return { kind: "disposable" };
  if (!bare || PLACEHOLDER_NAMES.has(bare) || /^(.)\1+$/.test(bare)) return { kind: "fake" };
  const rule = PROVIDERS[domain];
  if (rule) {
    // Gmail ignores dots, so "d.e@gmail.com" is as short as "de@gmail.com".
    const gmail = domain === "gmail.com" || domain === "googlemail.com";
    const len = gmail ? bare.length : base.length;
    if (len < rule.min || len > rule.max || PROVIDER_PLACEHOLDERS.has(bare)) return { kind: "fake" };
    if (gmail && !/^[a-z0-9.]+$/.test(base)) return { kind: "fake" };
  }
  return null;
}
