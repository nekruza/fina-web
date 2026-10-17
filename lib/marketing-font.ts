import { Fraunces } from "next/font/google";

/**
 * Fraunces with the SOFT axis, for `.fina-display` headings on the marketing
 * pages. Kept out of the root layout because the extra axis nearly doubles the
 * font file, and the app itself never uses it. next/font only preloads this on
 * routes that render a component importing it.
 */
export const frauncesSoft = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces-soft",
  display: "swap",
  axes: ["opsz", "SOFT"],
});
