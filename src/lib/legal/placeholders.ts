/** The `{name}` placeholders the built-in legal texts use; admin texts may use the same ones (A-16). */
import { AGREEMENT_BN, LEGAL_BN } from "./bn";
import { AGREEMENT_EN, LEGAL_EN } from "./en";
import { agreementToText, docToText, usedPlaceholders } from "./format";

export const LEGAL_PLACEHOLDERS: string[] = [
  ...new Set(
    [...Object.values(LEGAL_EN), ...Object.values(LEGAL_BN)].flatMap((d) => usedPlaceholders(docToText(d))).concat(usedPlaceholders(agreementToText(AGREEMENT_EN)), usedPlaceholders(agreementToText(AGREEMENT_BN))),
  ),
].sort();
