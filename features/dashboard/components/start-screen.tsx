import { heroEdgeClassName } from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { LanguageProvider } from "@/components/language-provider"
import { SiteHeader } from "@/components/site-header"
import type { PageLanguage } from "@/lib/page-language"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"

// The owner's Google Maps search screen, inside the app: before the first
// business (/dashboard) and for each one after (/dashboard/new). Calmer
// than the home page: a smaller title, no marketing lines. `children` is
// the search (the onboarding feature's GetStarted, passed in by the page).
// `close` sits in the panel's top right corner, beside the header.
export function StartScreen({
  language,
  welcome,
  title,
  hint,
  action,
  close,
  children,
}: {
  language: PageLanguage
  welcome?: string
  title: string
  hint: string
  action: React.ReactNode
  close?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <LanguageProvider language={language}>
      <div
        className={cn(
          "flex min-h-dvh flex-col bg-background p-2 sm:p-3",
          fontDisplay.variable
        )}
      >
        <section
          className={cn(
            "relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl",
            heroEdgeClassName
          )}
        >
          <HeroGradient />
          <div className="flex items-center">
            <div className="min-w-0 flex-1">
              <SiteHeader action={action} />
            </div>
            {close && <div className="pr-4">{close}</div>}
          </div>
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 px-4 pt-12 pb-24 text-center sm:pt-24">
            <div className="flex flex-col gap-2 font-display text-hero-foreground">
              {welcome && <p className="text-base font-medium">{welcome}</p>}
              <h1 className="text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                {title}
              </h1>
              <p className="text-base text-balance">{hint}</p>
            </div>
            {children}
          </main>
        </section>
      </div>
    </LanguageProvider>
  )
}
