import "server-only"
import { revalidatePath } from "next/cache"

// After a business's data changes: its public page and the owner area show
// it on their next visit.
export function revalidateBusiness(slug: string): void {
  revalidatePath("/b/" + slug)
  revalidatePath("/dashboard", "layout")
}
