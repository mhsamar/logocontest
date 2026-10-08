import "server-only";

/** A designer shown on the home page "designers you can trust" section (UI-JOURNEY P-01). */
export type FeaturedDesigner = {
  name: string;
  username: string;
  avatarUrl: string | null;
  /** Up to three public winning logos (never from private or blind contests). */
  logos: string[];
  /** Average client rating of their winning entries, or null when none is rated yet. */
  rating: number | null;
};

/**
 * Real designers only, never sample people. The section needs three designers with
 * three public winning logos each; until then it shows our example logos.
 * TODO(milestone 4/7): read winning entries and handover ratings.
 */
export async function getFeaturedDesigners(limit: number): Promise<FeaturedDesigner[]> {
  void limit;
  return [];
}
