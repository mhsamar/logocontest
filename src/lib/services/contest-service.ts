import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Answers } from "./types";

export type ContestServiceInfo = { service: string; serviceBrief: Answers; /** Final files the winner sends; null = the logo set. */ finalTypes: string[] | null };
const LOGO_INFO: ContestServiceInfo = { service: "logo", serviceBrief: {}, finalTypes: null };

/**
 * Which service each contest is for (owner, 2026-10-13). A separate query, so pages keep working before migration
 * 0045 adds the columns (every contest is then a logo contest).
 */
export async function contestServiceInfo(ids: string[]): Promise<Map<string, ContestServiceInfo>> {
  const out = new Map<string, ContestServiceInfo>();
  if (!ids.length) return out;
  const { data, error } = await createAdminClient().from("contests").select("id, service, service_brief, final_types").in("id", ids.slice(0, 500));
  for (const id of ids) out.set(id, LOGO_INFO);
  if (error) return out;
  for (const r of data ?? []) out.set(r.id as string, { service: (r.service as string) || "logo", serviceBrief: (r.service_brief as Answers) ?? {}, finalTypes: (r.final_types as string[] | null)?.length ? (r.final_types as string[]) : null });
  return out;
}
