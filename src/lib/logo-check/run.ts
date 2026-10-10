import "server-only";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { differenceHash } from "@/lib/entries/images";
import { getSettings } from "@/lib/settings";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { AiUnavailableError, compareShapes, readLogo, summarize, type Reading, type ShapeMatch } from "./ai";
import { certificateHtml, renderCertificate, type CertificateData } from "./certificate";
import { fetchImage, logoForAi, shrinkCandidate } from "./images";
import { checkHeadline, sourceRows } from "./present";
import { certNumber, hostOf, isOnHosts, overallScore, uniquenessScore, verdictFor, type CheckLimits, type MatchSource } from "./rules";
import { lensSearch, visionSearch, type Candidate, type SourceRun } from "./search";

/**
 * The background job for one check (owner, 2026-10-10; handoff "How a check runs"). Steps:
 * 1 read the logo, 2 search the web, 3 search our own designs, 4 compare shapes, 5 scores, 6 save + certificate.
 * The step number is saved as it goes so the pop-up can show progress. A failed check doesn't count.
 */

export const LOGO_CHECKS_BUCKET = "logo-checks";
/** Seconds one runner holds a check; after that a status poll may start it again. */
export const LEASE_SECONDS = 240;
const ATTEMPTS = 2;
const MAX_WEB = 14;
const MAX_SITE = 6;
const KEEP = 8;

export async function checkLimits(): Promise<CheckLimits> {
  const s = await getSettings(["limits.logo_checks_per_contest", "upgrades.logo_check_free_from", "upgrades.logo_scan_price", "limits.logo_check_close_from", "limits.logo_check_high_risk_from"]);
  return {
    perContest: s["limits.logo_checks_per_contest"],
    freeFrom: s["upgrades.logo_check_free_from"],
    price: s["upgrades.logo_scan_price"],
    closeFrom: s["limits.logo_check_close_from"],
    highRiskFrom: s["limits.logo_check_high_risk_from"],
  };
}

/** A reason the client can act on; anything else is shown as a technical problem. */
export class CheckError extends Error {
  constructor(readonly code: "not_logo" | "search_unavailable" | "ai_unavailable") {
    super(code);
  }
}

type CheckRow = {
  id: string;
  number: number;
  contest_id: string;
  entry_id: string | null;
  image_path: string;
  requested_by: string;
  attempts: number;
  reading: Reading | null;
  cost_usd: number | string;
};

export type Sources = {
  lens: SourceRun;
  vision: SourceRun;
  site: { ran: boolean; found: number; close: number };
  shape: { compared: number; close: number; closest: number };
  font: { look: string; guess: string; hasText: boolean };
};

const db = () => createAdminClient();
const setStep = (id: string, step: number) => db().from("logo_checks").update({ step }).eq("id", id);

/** Runs a check if no other runner holds it. Safe to call again at any time. */
export async function runLogoCheck(id: string, origin: string): Promise<void> {
  const { data } = await db().rpc("claim_logo_check", { p_id: id, p_lease_seconds: LEASE_SECONDS });
  const check = data as CheckRow | null;
  if (!check?.id) return;
  for (let attempt = 1; ; attempt++) {
    try {
      await work(check, origin);
      return;
    } catch (e) {
      const code = e instanceof CheckError ? e.code : e instanceof AiUnavailableError ? "ai_unavailable" : "technical";
      console.error(`[logo-check] ${certNumber(check.number)} attempt ${attempt}:`, e instanceof Error ? e.message : e);
      if (code !== "technical" || attempt >= ATTEMPTS || check.attempts > ATTEMPTS) {
        await db().from("logo_checks").update({ status: "failed", error: code, locked_until: null, finished_at: new Date().toISOString() }).eq("id", id);
        return;
      }
    }
  }
}

async function work(check: CheckRow, origin: string) {
  const store = getFileStorage();
  const limits = await checkLimits();
  const logo = await store.download(LOGO_CHECKS_BUCKET, check.image_path);
  const logoAi = await logoForAi(logo);
  let cost = Number(check.cost_usd) || 0;

  const { data: contest } = await db().from("contests").select("id, slug, website_url").eq("id", check.contest_id).single();

  // 1. Read the logo (kept, so a second attempt doesn't pay for it again).
  let reading = check.reading;
  if (!reading) {
    await setStep(check.id, 1);
    const r = await readLogo(logoAi);
    reading = r.data;
    cost += r.costUsd;
    await db().from("logo_checks").update({ reading, cost_usd: cost }).eq("id", check.id);
  }
  if (!reading.is_logo) throw new CheckError("not_logo");

  // 2. Search the web. Results on our own site or the client's site are dropped.
  await setStep(check.id, 2);
  const signed = (await store.createReadUrls(LOGO_CHECKS_BUCKET, [check.image_path], 900)).get(check.image_path);
  const [lens, vision] = await Promise.all([signed ? lensSearch(signed) : Promise.resolve({ run: { ran: false, found: 0, costUsd: 0 }, candidates: [] }), visionSearch(logo)]);
  if (!lens.run.ran && !vision.run.ran) throw new CheckError("search_unavailable");
  cost += lens.run.costUsd + vision.run.costUsd;
  const hosts = [hostOf(origin), "logocontest.bd", "logocontest.vercel.app", hostOf(contest?.website_url as string | null)];
  const seen = new Set<string>();
  const web = [...lens.candidates, ...vision.candidates]
    .filter((c) => !isOnHosts(c.pageUrl, hosts) && !c.imageUrls.some((u) => isOnHosts(u, hosts)))
    .filter((c) => (seen.has(c.imageUrls[0]) ? false : (seen.add(c.imageUrls[0]), true)))
    .slice(0, MAX_WEB);

  // 3. Designs from other contests on logocontest.bd, closest image fingerprint first.
  await setStep(check.id, 3);
  const hash = await differenceHash(logo);
  const { data: near } = await db().rpc("logo_check_similar_entries", { p_hash: hash, p_contest_id: check.contest_id, p_limit: MAX_SITE });
  const nearRows = (near ?? []) as { entry_id: string; contest_id: string; preview_path: string }[];
  const { data: nearInfo } = nearRows.length
    ? await db().from("entries").select("id, number, contest:contests!contest_id(slug, brand_name)").in("id", nearRows.map((r) => r.entry_id))
    : { data: [] };
  const info = new Map((nearInfo ?? []).map((e) => [e.id as string, e]));
  const site: (Candidate & { previewPath: string })[] = nearRows.map((r) => {
    const e = info.get(r.entry_id);
    const c = (Array.isArray(e?.contest) ? e?.contest[0] : e?.contest) as { slug: string; brand_name: string } | undefined;
    return {
      foundBy: "site",
      imageUrls: [],
      previewPath: r.preview_path,
      pageUrl: c ? `${origin}/contest/${c.slug}?tab=entries&entry=${e?.number}` : null,
      title: c ? `${c.brand_name} · Design #${e?.number}` : null,
      site: "logocontest.bd",
      entryId: r.entry_id,
    };
  });

  // 4. Compare shapes: read each image, then 5 at a time with the logo.
  await setStep(check.id, 4);
  type Loaded = { c: Candidate; img: Buffer; imageUrl: string | null };
  const loaded = (
    await Promise.all<Loaded | null>([
      ...web.map(async (c): Promise<Loaded | null> => {
        for (const u of c.imageUrls) {
          const raw = await fetchImage(u);
          const img = raw && (await shrinkCandidate(raw));
          if (img) return { c, img, imageUrl: u };
        }
        return null;
      }),
      ...site.map(async (c): Promise<Loaded | null> => {
        const raw = await store.download(ENTRY_FILES_BUCKET, c.previewPath).catch(() => null);
        const img = raw && (await shrinkCandidate(raw));
        return img ? { c, img, imageUrl: null } : null;
      }),
    ])
  ).filter((x): x is Loaded => !!x);

  const scored: { c: Candidate; img: Buffer; imageUrl: string | null; m: ShapeMatch }[] = [];
  const batches: (typeof loaded)[] = [];
  for (let i = 0; i < loaded.length; i += 5) batches.push(loaded.slice(i, i + 5));
  const results = await Promise.all(batches.map((b) => compareShapes(logoAi, b.map((x) => x.img))));
  results.forEach((r, bi) => {
    cost += r.costUsd;
    for (const m of r.data) {
      const x = batches[bi][m.n - 1];
      if (x) scored.push({ ...x, m: { ...m, similarity: Math.max(0, Math.min(100, Math.round(m.similarity))) } });
    }
  });
  const top = scored.sort((a, b) => b.m.similarity - a.m.similarity).slice(0, KEEP);

  // 5. Scores, the font note and the advice.
  await setStep(check.id, 5);
  const closest = top[0]?.m.similarity ?? 0;
  const closeCount = top.filter((t) => t.m.similarity >= limits.closeFrom).length;
  const verdict = verdictFor(top.map((t) => t.m.similarity), limits);
  const uniqueness = uniquenessScore(closest);
  const overall = overallScore(uniqueness, reading.legibility.score, reading.colour.score);
  const facts = [
    `Logo: ${reading.description}. Type: ${reading.logo_type}. Text: "${reading.text}". Font looks like: ${reading.font_look || "no text"}.`,
    `Searched: ${[lens.run.ran && "Google Lens", vision.run.ran && "Google Cloud Vision", "logocontest.bd designs"].filter(Boolean).join(", ")}. Images compared: ${loaded.length}.`,
    `Closest similarity: ${closest}/100. Close matches (${limits.closeFrom}+): ${closeCount}. Verdict: ${verdict}.`,
    top[0] ? `Closest match same: ${top[0].m.same.join("; ")}. Different: ${top[0].m.different.join("; ")}.` : "No similar image was found.",
    `Scores: uniqueness ${uniqueness}, legibility ${reading.legibility.score}, colour ${reading.colour.score}, overall ${overall}.`,
  ].join("\n");
  const sum = await summarize(facts);
  cost += sum.costUsd;

  // 6. Save: our own copy of every kept image, then the check, then the certificate.
  await setStep(check.id, 6);
  await db().from("logo_check_matches").delete().eq("check_id", check.id);
  const rows = await Promise.all(
    top.map(async (t, i) => {
      const path = `${check.id}/match-${i}.png`;
      await store.upload(LOGO_CHECKS_BUCKET, path, t.img, "image/png");
      return {
        check_id: check.id,
        position: i,
        found_by: t.c.foundBy as MatchSource,
        image_path: path,
        image_url: t.imageUrl && !t.imageUrl.startsWith("data:") ? t.imageUrl.slice(0, 2000) : null,
        page_url: t.c.pageUrl?.slice(0, 2000) ?? null,
        title: t.c.title?.slice(0, 300) ?? null,
        site: (t.c.site ?? hostOf(t.c.pageUrl ?? t.imageUrl))?.slice(0, 200) ?? null,
        entry_id: t.c.entryId ?? null,
        similarity: t.m.similarity,
        same: t.m.same.slice(0, 3),
        different: t.m.different.slice(0, 3),
        is_close: t.m.similarity >= limits.closeFrom,
      };
    }),
  );
  if (rows.length) {
    const { error } = await db().from("logo_check_matches").insert(rows);
    if (error) throw new Error(error.message);
  }
  const sources: Sources = {
    lens: lens.run,
    vision: vision.run,
    site: { ran: true, found: site.length, close: top.filter((t) => t.c.foundBy === "site" && t.m.similarity >= limits.closeFrom).length },
    shape: { compared: loaded.length, close: closeCount, closest },
    font: { look: reading.font_look, guess: reading.font_guess, hasText: Boolean(reading.text.trim()) },
  };
  const { error } = await db()
    .from("logo_checks")
    .update({
      status: "done",
      step: 6,
      verdict,
      scores: {
        uniqueness: { score: uniqueness, line: sum.data.uniqueness_line },
        legibility: reading.legibility,
        colour: reading.colour,
        overall: { score: overall, line: sum.data.overall_line },
      },
      advice: sum.data.advice,
      sources,
      cost_usd: Math.round(cost * 10000) / 10000,
      error: null,
      locked_until: null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", check.id);
  if (error) throw new Error(error.message);

  // The certificate is made now; if this fails it is made when it is first downloaded.
  await makeCertificate(check.id, origin).catch((e) => console.error("[logo-check] certificate:", e instanceof Error ? e.message : e));
}

/** Builds the certificate PDF and PNG for a finished check and stores both. Returns their paths. */
export async function makeCertificate(id: string, origin: string): Promise<{ pdf: string; png: string }> {
  const store = getFileStorage();
  const { data: c } = await db()
    .from("logo_checks")
    .select(
      "id, number, status, verdict, scores, sources, image_path, finished_at, created_at, entry_id, contest:contests!contest_id(brand_name, contest_number), entry:entries!entry_id(number, designer:profiles!designer_id(name)), requester:profiles!requested_by(name), matches:logo_check_matches(position, image_path, similarity, is_close, site, same, different, found_by)",
    )
    .eq("id", id)
    .single();
  if (!c || c.status !== "done") throw new Error("Check is not finished");
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const contest = one(c.contest as unknown as { brand_name: string; contest_number: number | null } | null);
  const entry = one(c.entry as unknown as { number: number; designer: { name: string } | { name: string }[] | null } | null);
  const matches = [...((c.matches as unknown as { position: number; image_path: string; similarity: number; is_close: boolean; site: string | null; same: string[]; different: string[]; found_by: MatchSource }[]) ?? [])].sort((a, b) => a.position - b.position);
  const toUri = async (path: string) => `data:image/png;base64,${Buffer.from(await store.download(LOGO_CHECKS_BUCKET, path)).toString("base64")}`;
  const scores = c.scores as Record<"uniqueness" | "legibility" | "colour" | "overall", { score: number }>;
  const sources = c.sources as Sources;
  const limits = await checkLimits();
  const head = checkHeadline(c.verdict as "no_match" | "similar" | "high_risk", sources, limits);

  const data: CertificateData = {
    number: c.number as number,
    origin,
    logoDataUri: await toUri(c.image_path as string),
    contest: `${contest?.brand_name ?? ""}${contest?.contest_number ? ` · LC-${String(contest.contest_number).padStart(4, "0")}` : ""}`,
    design: entry ? `Design #${entry.number}` : "Uploaded image",
    designer: entry ? (one(entry.designer)?.name ?? null) : null,
    checkedFor: one(c.requester as unknown as { name: string } | null)?.name ?? "",
    checkedAt: new Date((c.finished_at ?? c.created_at) as string),
    verdict: c.verdict as "no_match" | "similar" | "high_risk",
    headline: head.headline,
    subline: head.subline,
    matches: await Promise.all(matches.slice(0, 4).map(async (m) => ({ dataUri: await toUri(m.image_path), similarity: m.similarity, close: m.is_close, where: m.found_by === "site" ? "logocontest.bd" : (m.site ?? "the web") }))),
    closest: matches[0] ? { same: matches[0].same, different: matches[0].different } : null,
    scores: [
      { label: "Uniqueness", score: scores.uniqueness.score },
      { label: "Legibility", score: scores.legibility.score },
      { label: "Colour & contrast", score: scores.colour.score },
      { label: "Overall", score: scores.overall.score },
    ],
    searched: sourceRows(sources),
  };
  const { pdf, png } = await renderCertificate(await certificateHtml(data));
  const paths = { pdf: `${id}/certificate.pdf`, png: `${id}/certificate.png` };
  await store.upload(LOGO_CHECKS_BUCKET, paths.pdf, pdf, "application/pdf");
  await store.upload(LOGO_CHECKS_BUCKET, paths.png, png, "image/png");
  await db().from("logo_checks").update({ certificate_pdf_path: paths.pdf, certificate_png_path: paths.png }).eq("id", id);
  return paths;
}
