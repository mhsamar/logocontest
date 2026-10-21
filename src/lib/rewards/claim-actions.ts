"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { linkOrigin } from "@/lib/site-origin";
import type { MessageKey } from "@/lib/i18n/translate";
import { normalizeBdMobile } from "@/lib/phone";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimDeadline, myReward, tellAdminsClaimed } from "./claims";

export type ClaimResult = { ok: true } | { ok: false; error: MessageKey; field?: "name" | "mobile" | "address" | "confirm" };

/**
 * The winner claims their monthly prize (owner, 2026-10-11): full name, Bangladesh mobile (11 digits starting with
 * 01), full address and "These details are correct". Checked here and again in the database; once only.
 */
export async function claimReward(rewardId: string, f: { name: string; mobile: string; address: string; confirm: boolean }): Promise<ClaimResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth.errors.generic" };
  const reward = await myReward(rewardId, user.id);
  if (!reward) return { ok: false, error: "auth.errors.generic" };
  if (reward.status !== "not_claimed") return { ok: false, error: "monthlyReward.errors.already" };
  const deadline = claimDeadline(await getSetting("rewards.claim_deadline"));
  if (deadline && new Date() > deadline) return { ok: false, error: "monthlyReward.errors.late" };

  const name = String(f.name ?? "").replace(/\s+/g, " ").trim();
  const address = String(f.address ?? "").replace(/\s+/g, " ").trim();
  const e164 = normalizeBdMobile(String(f.mobile ?? ""));
  if (name.length < 3 || name.length > 80) return { ok: false, error: "monthlyReward.errors.name", field: "name" };
  if (!e164) return { ok: false, error: "monthlyReward.errors.mobile", field: "mobile" };
  if (address.length < 10 || address.length > 400) return { ok: false, error: "monthlyReward.errors.address", field: "address" };
  if (f.confirm !== true) return { ok: false, error: "monthlyReward.errors.confirm", field: "confirm" };

  const { error } = await createAdminClient().rpc("claim_monthly_reward", { p_reward_id: rewardId, p_user_id: user.id, p_name: name, p_mobile: `0${e164.slice(4)}`, p_address: address });
  if (error) return { ok: false, error: /already/.test(error.message) ? "monthlyReward.errors.already" : "monthlyReward.errors.generic" };
  await tellAdminsClaimed(reward, user.name, await linkOrigin());
  refresh();
  return { ok: true };
}
