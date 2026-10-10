/** Where a contest is (design/admin/contests.html): one of four stages, or ended without a result. */
export type ContestStage = { key: "open" | "choosing" | "files" | "completed" | "no_result" | "cancelled" | "other"; step: number };

export function contestStage(status: string): ContestStage {
  switch (status) {
    case "open":
      return { key: "open", step: 1 };
    case "judging":
      return { key: "choosing", step: 2 };
    case "winner_selected":
    case "handover":
      return { key: "files", step: 3 };
    case "completed":
      return { key: "completed", step: 4 };
    case "no_result":
      return { key: "no_result", step: 0 };
    case "cancelled":
      return { key: "cancelled", step: 0 };
    default:
      return { key: "other", step: 0 };
  }
}

export const LIVE_STATUSES = ["open", "judging", "winner_selected", "handover"];
export const OLD_STATUSES = ["completed", "no_result", "cancelled"];
