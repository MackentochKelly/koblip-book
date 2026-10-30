import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { MotionProvider } from "@/components/motion-provider"
import { SmoothScroll } from "@/components/smooth-scroll"
import { ScrollTopOnReload } from "@/components/scroll-top-on-reload"
import { ThemeProvider } from "@/components/theme-provider"
import {
  DEFAULT_LANGUAGE,
  isPageLanguage,
  PAGE_LANGUAGE_HEADER,
} from "@/lib/page-language"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// The page fills the whole phone screen, under the notch and the home line
// (WebKit: viewport-fit=cover), so env(safe-area-inset-*) has real values
// and the bars keep clear of them.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

// The name under the icon when the page is added to an iPhone's Home Screen
// (the icon itself is app/apple-icon.tsx).
export const metadata: Metadata = {
  appleWebApp: { title: "Koblip Book" },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The page's own language (picked in proxy.ts), so Safari and VoiceOver
  // read a Spanish page as Spanish.
  const asked = (await headers()).get(PAGE_LANGUAGE_HEADER)
  return (
    <html
      lang={isPageLanguage(asked) ? asked : DEFAULT_LANGUAGE}
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ScrollTopOnReload />
        <ThemeProvider>
          <MotionProvider>
            <SmoothScroll>{children}</SmoothScroll>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
