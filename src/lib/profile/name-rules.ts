/**
 * People's names (owner, 2026-10-14): clients and designers write their name with letters only, in English or
 * Bangla, and single spaces between the words. No digits (1, 2, ১, ২) and no signs like . / ,
 * Pure: used by the sign-up and profile actions and the tests.
 */

/** Letters with their marks (Bangla vowel signs, hasanta) and the joiners Bangla text uses, then spaces between words. */
const WORD = "[\\p{L}\\p{M}\\u200c\\u200d]+";
export const PERSON_NAME = new RegExp(`^${WORD}(?: ${WORD})*$`, "u");

export const isPersonName = (name: string) => PERSON_NAME.test(name);

/** A name made from other text (a new client's brand name): only its letters and spaces are kept. */
export const personNameFrom = (text: string) =>
  text
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}‌‍\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
