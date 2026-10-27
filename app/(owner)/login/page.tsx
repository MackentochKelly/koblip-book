import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { getSession } from "@/lib/dal"
import { safeNext } from "@/lib/safe-next"

export const metadata: Metadata = { title: "Log in" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams
  const target = safeNext(typeof next === "string" ? next : undefined)
  if (await getSession()) {
    redirect(target)
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-4 pt-10 sm:pt-20">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Log in</CardTitle>
          </CardHeader>
          <CardContent>
            <AuthForm next={target} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
