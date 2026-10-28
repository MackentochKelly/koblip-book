import { Skeleton } from "@/components/ui/skeleton"

// Shown the moment a tab is tapped, inside the dashboard's top bar and tab
// bar, until the page is ready: a title, its count line and a few rows
// (nextjs.org/docs/app/api-reference/file-conventions/loading).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-40 w-full rounded-4xl" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  )
}
