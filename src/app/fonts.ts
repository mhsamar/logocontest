import { Instrument_Sans, Urbanist } from "next/font/google";

// Home page design (owner, 2026-10-10; Design/logocontest-home-design.html): Instrument Sans headings,
// Urbanist body. Bangla falls back to Hind Siliguri, loaded site-wide in the root layout.
export const landingHeading = Instrument_Sans({ variable: "--font-lc-heading", subsets: ["latin"], weight: ["500", "600"], display: "swap" });
export const landingBody = Urbanist({ variable: "--font-lc-body", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
