import { Instrument_Sans, Urbanist } from "next/font/google";
import localFont from "next/font/local";

// Home page design (owner, 2026-10-10; Design/logocontest-home-design.html): Instrument Sans headings,
// Urbanist body. Bangla falls back to Hind Siliguri, loaded site-wide in the root layout.
export const landingHeading = Instrument_Sans({ variable: "--font-lc-heading", subsets: ["latin"], weight: ["500", "600"], display: "swap" });
export const landingBody = Urbanist({ variable: "--font-lc-body", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

// Bangla digits only (owner, 2026-10-14): Hind Siliguri's "১" is very small, so ০–৯ come from Noto Sans Bengali.
// Listed before Hind Siliguri in every font stack; the file has nothing but the ten digits.
export const banglaDigits = localFont({
  src: "../fonts/bn-digits.woff2",
  variable: "--font-bn-digits",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+09E6-09EF" }],
});
