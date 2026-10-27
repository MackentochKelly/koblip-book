import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Toaster } from "@/components/ui/sonner"
import { getBusinessPage } from "@/features/business-page/api/get-business-page"
import { ClaimButton } from "@/features/dashboard/components/claim-button"
import { requireOwner } from "@/lib/dal"

export const metadata: Metadata = { title: "Claim this business" }

type Props = {
  params: Promise<{ slug: string }>
}

export default async function ClaimPage({ params }: Props) {
  const { slug } = await params
  const owner = await requireOwner(`/dashboard/claim/${slug}`)
  const data = await getBusinessPage(slug)
  if (!data) {
    notFound()
  }
  const { business } = data
  if (business.ownerId === owner.userId) {
    redirect(`/dashboard/${business.id}`)
  }
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">{business.name}</CardTitle>
          <CardDescription>
            {business.ownerId
              ? "Someone already manages this business."
              : business.address ?? "Take bookings on this page for free."}
          </CardDescription>
        </CardHeader>
        {!business.ownerId && (
          <CardContent className="flex flex-col">
            <ClaimButton slug={business.slug} />
          </CardContent>
        )}
      </Card>
      <Toaster />
    </main>
  )
}
