import { Skeleton } from "@/components/ui/skeleton"

// Shown inside the WhatsApp frame (its title and tabs stay) until a part is
// ready: a few rows. Each part's loading.tsx shows it, since one at the
// layout would only show on the first visit
// (nextjs.org/docs/app/api-reference/file-conventions/loading).
export function PartSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  )
}
