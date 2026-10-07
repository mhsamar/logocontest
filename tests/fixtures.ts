import { emptyBrief, type Brief } from "@/lib/contests/brief";

export const validBrief = (): Brief => ({
  ...emptyBrief(),
  brandName: "Rahim Tea House",
  businessType: "food",
  businessDescription: "A small tea stall in Mirpur that sells milk tea and snacks.",
  styles: ["wordmark", "emblem"],
  colors: ["#0f766e"],
  usedOn: ["signboard", "social"],
  likes: "Warm colours, a simple cup shape, and friendly rounded letters.",
});
