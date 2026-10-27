import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ScrollTopOnReload } from "@/components/scroll-top-on-reload"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ScrollTopOnReload />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
