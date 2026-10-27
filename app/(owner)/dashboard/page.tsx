import { redirect } from "next/navigation"
import { getMyBusinesses } from "@/features/dashboard/api/queries"
import { requireOwner } from "@/lib/dal"

// The owner's first business, or the home page to add one.
export default async function DashboardPage() {
  await requireOwner("/dashboard")
  const businesses = await getMyBusinesses()
  redirect(businesses.length ? `/dashboard/${businesses[0].id}` : "/")
}
