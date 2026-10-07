import "server-only";
import { liveContests, type ContestRow } from "./browse";

/**
 * Home page section 2 (BLUEPRINT §14): recent winning logos, or live contests
 * until real winners exist. Only real rows — never sample data.
 * TODO(milestone 4/7): winners need entries and completed handovers.
 */
export async function getHomeShowcase(limit: number): Promise<{ kind: "winners" | "live"; contests: ContestRow[] }> {
  return { kind: "live", contests: await liveContests(limit) };
}
