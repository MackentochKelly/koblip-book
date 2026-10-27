import type { Metadata } from "next"
import Link from "next/link"

import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { getSession } from "@/lib/dal"

export const metadata: Metadata = {
  title: "Koblip Book",
  description: "Your booking page in one minute.",
}

export default async function HomePage() {
  const signedIn = (await getSession()) !== null
  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-b from-primary/15 via-primary/5 to-background">
      <SiteHeader
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={signedIn ? "/dashboard" : "/login"} />}
          >
            {signedIn ? "Dashboard" : "Log in"}
          </Button>
        }
      />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pt-10 pb-16 sm:pt-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Your booking page in one minute
          </h1>
          <p className="text-lg text-muted-foreground">
            Find your business. We build the rest.
          </p>
        </div>
        <Card className="shadow-lg">
          <CardContent>
            <GetStarted signedIn={signedIn} claim={claimBusiness} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
