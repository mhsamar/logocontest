/** The seven required declarations on D-04 (BLUEPRINT §9.2). Texts live in i18n under submit.declarations.* */
export const DECLARATION_KEYS = ["own", "custom", "noTrademark", "noAi", "deliver", "noContact", "understand"] as const;
export type DeclarationKey = (typeof DECLARATION_KEYS)[number];
