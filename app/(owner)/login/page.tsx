import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { GlassCard } from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { SiteHeader } from "@/components/site-header"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { getSession } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import { safeNext } from "@/lib/safe-next"

export const metadata: Metadata = { title: "Log in" }

// The home page's look: one rounded panel on the moving gradient, the
// login card in the same glass frame as the home box.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams
  const target = safeNext(typeof next === "string" ? next : undefined)
  if (await getSession()) {
    redirect(target)
  }
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background p-2 sm:p-3",
        fontDisplay.variable
      )}
    >
      <section className="relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl">
        <HeroGradient />
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4 pt-6 pb-24">
          <h1 className="font-display text-3xl font-medium tracking-tight text-hero-foreground">
            Log in
          </h1>
          <GlassCard>
            <AuthForm
              next={target}
              googleError={typeof error === "string" ? error : null}
            />
          </GlassCard>
        </main>
      </section>
    </div>
  )
}
