import "server-only";
import { LogSmsSender } from "./log-sender";
import type { SmsSender } from "./types";

export type { SmsSender };

export function getSmsSender(): SmsSender {
  const driver = process.env.SMS_DRIVER ?? "log";
  switch (driver) {
    case "log":
      return new LogSmsSender();
    default:
      throw new Error(`Unknown SMS_DRIVER "${driver}". Real providers are added in Milestone 9.`);
  }
}
