import {
  fullScreenHostClassName,
  GlassCard,
  heroEdgeClassName,
} from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { LanguageProvider } from "@/components/language-provider"
import { SiteHeader } from "@/components/site-header"
import { StickyHeader } from "@/components/sticky-header"
import { fontDisplay } from "@/lib/fonts"
import type { PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"

// The home page's look for a single task: one rounded panel on the moving
// gradient and a title over what the page holds. `wide` is the home box's
// width, so a card coming from it keeps its size.
export function HeroPage({
  language,
  title,
  wide = false,
  children,
}: {
  language: PageLanguage
  title: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <LanguageProvider language={language}>
      <div className={cn("flex min-h-dvh flex-col bg-background p-2 sm:p-3", fontDisplay.variable)}>
        {/* The header stays on top while the page scrolls. */}
        <StickyHeader>
          <SiteHeader floating />
        </StickyHeader>
        <section
          className={cn(
            "relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl",
            heroEdgeClassName,
            fullScreenHostClassName
          )}
        >
          <HeroGradient />
          <main
            className={cn(
              "mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 pt-22 pb-24",
              wide ? "max-w-xl" : "max-w-sm"
            )}
          >
            <h1 className="text-center font-display text-3xl font-medium tracking-tight text-hero-foreground">
              {title}
            </h1>
            {children}
          </main>
        </section>
      </div>
    </LanguageProvider>
  )
}

// The same page with one glass card: logging in, a new password and the
// links a team member opens (their invite and their Google Calendar link).
export function HeroCardPage({
  language,
  title,
  children,
}: {
  language: PageLanguage
  title: string
  children: React.ReactNode
}) {
  return (
    <HeroPage language={language} title={title}>
      <GlassCard>{children}</GlassCard>
    </HeroPage>
  )
}
