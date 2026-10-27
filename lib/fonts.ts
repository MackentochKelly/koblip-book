import { Instrument_Serif, Inter_Tight } from "next/font/google"

// The owner pages' title type: a tight sans, with a serif italic for the
// home title's one accent word. Put `.variable` on the page's outer box,
// then use `font-display` / `font-serif`.
export const fontDisplay = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-display",
})

export const fontSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-serif",
})
