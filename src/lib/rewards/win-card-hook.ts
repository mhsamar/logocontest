import "server-only";
import { after } from "next/server";
import { siteOrigin } from "@/lib/email";
import { createWinCard } from "./win-cards";

/**
 * After a winner is picked (by the client or an admin): makes the win card in the background, tells the designer,
 * and draws both pictures straight away so they are ready when the designer opens them (owner, 2026-10-11).
 */
export async function afterWinnerPicked(contestId: string, entryId: string): Promise<void> {
  const origin = await siteOrigin();
  after(async () => {
    const slug = await createWinCard(contestId, entryId, origin);
    if (!slug) return;
    for (const size of ["square", "story"] as const) {
      await fetch(`${origin}/api/cards/win/${slug}/${size}`, { cache: "no-store" }).catch(() => undefined);
    }
  });
}
