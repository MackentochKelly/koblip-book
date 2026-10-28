import { redirect } from "next/navigation"

import { HeroGradient } from "@/components/hero-gradient"
import { SiteHeader } from "@/components/site-header"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { getMyBusinesses } from "@/features/dashboard/api/queries"
import { AccountMenu } from "@/features/dashboard/components/account-menu"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { requireOwner } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"

// Where every login lands: the owner's first business, or, with none yet,
// one step only: find the business on Google Maps (the home page's box).
// Inside the app it greets the owner and stays calmer than the home page:
// a smaller title, no marketing lines.
export default async function DashboardPage() {
  const owner = await requireOwner("/dashboard")
  const businesses = await getMyBusinesses()
  if (businesses.length) {
    redirect(`/dashboard/${businesses[0].id}`)
  }
  const firstName = owner.name.trim().split(/\s+/)[0]
  const t = (await getOwnerMessages()).shell.start
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background p-2 sm:p-3",
        fontDisplay.variable
      )}
    >
      <section className="relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl">
        <HeroGradient />
        <SiteHeader
          action={
            <AccountMenu
              owner={{
                name: owner.name,
                email: owner.email,
                image: owner.image,
              }}
            />
          }
        />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 px-4 pt-12 pb-24 text-center sm:pt-24">
          <div className="flex flex-col gap-2 font-display text-hero-foreground">
            {firstName && (
              <p className="text-base font-medium">{t.welcome(firstName)}</p>
            )}
            <h1 className="text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              {t.title}
            </h1>
            <p className="text-base text-balance">
              {t.hint}
            </p>
          </div>
          <GetStarted signedIn claim={claimBusiness} hint={false} />
        </main>
      </section>
    </div>
  )
}
