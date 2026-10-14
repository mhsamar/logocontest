import "server-only";
import { resolve4, resolve6, resolveCname, resolveMx } from "node:dns/promises";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { emailProblem, isKnownProvider, parseDomainList, splitEmail } from "./email-rules";

/**
 * Sign-up and email changes (owner, 2026-10-14): only real emails. The rules in ./email-rules.ts, then for an unknown
 * domain two DNS look-ups: it must take mail (MX), and it must have a website (temporary-inbox domains usually have
 * none). A look-up that fails for another reason (timeout, DNS trouble) never blocks anyone.
 */

type Answer = "yes" | "no" | "unknown";
const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA", "ENOTIMP", "EBADNAME"]);
const TIMEOUT_MS = 2500;

async function has(lookup: () => Promise<unknown[]>): Promise<Answer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const list = await Promise.race([lookup(), new Promise<never>((_, reject) => (timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), TIMEOUT_MS)))]);
    return list.length > 0 ? "yes" : "no";
  } catch (e) {
    return NOT_FOUND.has((e as { code?: string }).code ?? "") ? "no" : "unknown";
  } finally {
    clearTimeout(timer);
  }
}

const anyYes = (answers: Answer[]): Answer => (answers.includes("yes") ? "yes" : answers.includes("unknown") ? "unknown" : "no");

/** Kept for a while per server instance, so the sign-up steps don't look the same domain up again and again. */
const cache = new Map<string, { at: number; mail: Answer; web: Answer }>();
const CACHE_MS = 30 * 60_000;

async function domainFacts(domain: string): Promise<{ mail: Answer; web: Answer }> {
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const [mail, root4, root6, www4, wwwCname] = await Promise.all([
    has(() => resolveMx(domain)),
    has(() => resolve4(domain)),
    has(() => resolve6(domain)),
    has(() => resolve4(`www.${domain}`)),
    has(() => resolveCname(`www.${domain}`)),
  ]);
  const facts = { mail, web: anyYes([root4, root6, www4, wwwCname]) };
  if (mail !== "unknown" && facts.web !== "unknown") cache.set(domain, { at: Date.now(), ...facts });
  return facts;
}

export type EmailRejection = { key: MessageKey; params?: MessageParams };

/** Why this email can't be used, or null. `email` is already normalised (normalizeEmail). */
export async function emailRejection(email: string): Promise<EmailRejection | null> {
  const s = await getSettings(["auth.blocked_email_domains", "auth.allowed_email_domains"]);
  const allowed = parseDomainList(s["auth.allowed_email_domains"]);
  const problem = emailProblem(email, { blocked: parseDomainList(s["auth.blocked_email_domains"]), allowed });
  if (problem?.kind === "typo") return { key: "auth.errors.emailTypo", params: { email: problem.suggestion } };
  if (problem?.kind === "disposable") return { key: "auth.errors.emailDisposable" };
  if (problem) return { key: "auth.errors.emailFake" };
  const domain = splitEmail(email)!.domain;
  if (isKnownProvider(domain) || allowed.has(domain)) return null;
  const facts = await domainFacts(domain);
  if (facts.mail === "no") return { key: "auth.errors.emailNoMail" };
  if (facts.mail === "yes" && facts.web === "no") return { key: "auth.errors.emailDisposable" };
  return null;
}
