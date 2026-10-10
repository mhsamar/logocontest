/** Pure part of homeLogos(): admin-featured first in their order, then the newest; no repeats, no missing images. */
export function pickLogos(
  featuredIds: string[],
  featured: { entryId: string; coverUrl: string | null }[],
  newest: { entryId: string; coverUrl: string | null }[],
  limit: number,
): string[] {
  const byId = new Map(featured.map((d) => [d.entryId, d]));
  const ordered = [...featuredIds.map((id) => byId.get(id)).filter((d): d is { entryId: string; coverUrl: string | null } => !!d), ...newest];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of ordered) {
    if (!d.coverUrl || seen.has(d.entryId)) continue;
    seen.add(d.entryId);
    out.push(d.coverUrl);
    if (out.length >= limit) break;
  }
  return out;
}

/** Days-left chip on a live contest card: red when fewer than 10 days are left, orange otherwise (design file). */
export function timeLeft(endsAt: Date | null, now: Date): { kind: "days" | "hours"; n: number; soon: boolean } | null {
  if (!endsAt) return null;
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return null;
  if (ms < 86_400_000) return { kind: "hours", n: Math.max(1, Math.ceil(ms / 3_600_000)), soon: true };
  const n = Math.ceil(ms / 86_400_000);
  return { kind: "days", n, soon: n < 10 };
}
