import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { GlassCard, heroEdgeClassName } from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { LanguageProvider } from "@/components/language-provider"
import { SiteHeader } from "@/components/site-header"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { authWordsFor } from "@/features/owner-auth/i18n"
import { getSession } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import { safeNext } from "@/lib/safe-next"

export async function generateMetadata(): Promise<Metadata> {
  return { title: authWordsFor(await getOwnerLanguage()).logIn }
}

// The home page's look: one rounded panel on the moving gradient, the
// login card in the same glass frame as the home box.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams
  const target = safeNext(typeof next === "string" ? next : undefined)
  if (await getSession()) {
    redirect(target)
  }
  const language = await getOwnerLanguage()
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
          <SiteHeader />
          <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4 pt-6 pb-24">
            <h1 className="font-display text-3xl font-medium tracking-tight text-hero-foreground">
              {authWordsFor(language).logIn}
            </h1>
            <GlassCard>
              <AuthForm
                next={target}
                googleError={typeof error === "string" ? error : null}
                language={language}
              />
            </GlassCard>
          </main>
        </section>
      </div>
    </LanguageProvider>
  )
}
