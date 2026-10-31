import { GlassCard, heroEdgeClassName } from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { LanguageProvider } from "@/components/language-provider"
import { SiteHeader } from "@/components/site-header"
import { StickyHeader } from "@/components/sticky-header"
import { fontDisplay } from "@/lib/fonts"
import type { PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"

// The look of the login page: one rounded panel on the moving gradient, a
// title and one glass card. For a team member's calendar link (G5).
export function TeamCalendarPage({
  language,
  title,
  children,
}: {
  language: PageLanguage
  title: string
  children: React.ReactNode
}) {
  return (
    <LanguageProvider language={language}>
      <div className={cn("flex min-h-dvh flex-col bg-background p-2 sm:p-3", fontDisplay.variable)}>
        <StickyHeader>
          <SiteHeader floating />
        </StickyHeader>
        <section
          className={cn(
            "relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl",
            heroEdgeClassName
          )}
        >
          <HeroGradient />
          <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4 pt-22 pb-24">
            <h1 className="text-center font-display text-3xl font-medium tracking-tight text-hero-foreground">
              {title}
            </h1>
            <GlassCard className="w-full">{children}</GlassCard>
          </main>
        </section>
      </div>
    </LanguageProvider>
  )
}
