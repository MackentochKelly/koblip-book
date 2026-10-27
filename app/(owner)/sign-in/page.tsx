import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { getSession } from "@/lib/dal"
import { safeNext } from "@/lib/safe-next"

export const metadata: Metadata = { title: "Sign in" }

type Props = {
  searchParams: Promise<{ next?: string }>
}

export default async function Page({ searchParams }: Props) {
  const next = safeNext((await searchParams).next)
  if (await getSession()) {
    redirect(next)
  }
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <AuthForm mode="sign-in" next={next} />
    </main>
  )
}
