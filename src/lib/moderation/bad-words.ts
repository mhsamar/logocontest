/**
 * Bad words in comments (owner, 2026-10-12). A comment with one of these is not posted, and a designer who tries is
 * suspended for 48 hours. Whole words only, so "Dickens", "balloon" or "বালিশ" (pillow) are fine. More words can be
 * added by an admin under Blocked terms.
 */
const WORDS = new Set(
  [
    // English, with the common endings.
    "fuck", "fucks", "fucked", "fucker", "fuckers", "fucking", "fuckin", "fuk", "fck", "motherfucker", "motherfuckers",
    "shit", "shits", "shitty", "bullshit", "asshole", "assholes", "bitch", "bitches", "bastard", "bastards", "dick",
    "dicks", "cunt", "cunts",
    // Banglish.
    "bal", "baler", "bokachoda", "choda", "chod", "gandu", "haramjada", "haramjadi", "madarchod", "madarchot", "shala",
    "banchod", "bainchod",
    // Bangla.
    "বাল", "বালের", "বোকাচোদা", "চোদা", "চোদ", "গাণ্ডু", "গান্ডু", "হারামজাদা", "হারামজাদি", "মাদারচোদ", "শালা",
  ].map((w) => w.normalize("NFC")),
);

/** The first bad word in the text, or null. */
export function findBadWord(text: string): string | null {
  for (const w of text.toLowerCase().normalize("NFC").split(/[^\p{L}\p{M}\d]+/u)) {
    if (w && WORDS.has(w)) return w;
  }
  return null;
}
