import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import { AddBusinessForm } from "@/features/dashboard/components/add-business-form"
import { requireOwner } from "@/lib/dal"
import { addBusinessFromLink } from "./actions"

export const metadata: Metadata = { title: "Add your business" }

export default async function NewBusinessPage() {
  await requireOwner("/dashboard/new")
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <AddBusinessForm action={addBusinessFromLink} />
      <Toaster />
    </main>
  )
}
