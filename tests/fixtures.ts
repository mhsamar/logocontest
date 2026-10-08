import { emptyBrief, type Brief } from "@/lib/contests/brief";

export const validBrief = (): Brief => ({
  ...emptyBrief(),
  brandName: "Rahim Tea House",
  businessType: "food",
  businessDescription: "A small tea stall in Mirpur that sells milk tea and snacks.",
  targetAudience: "Office workers and students in Mirpur.",
  styles: ["wordmark", "emblem"],
  colors: ["#0f766e"],
  usedOn: ["signboard", "social"],
});
