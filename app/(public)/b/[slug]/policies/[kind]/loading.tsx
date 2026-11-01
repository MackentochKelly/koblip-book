import { Skeleton } from "@/components/ui/skeleton"

// The policy page's shape while it loads: the way back, the title, its
// date and a few lines. Without it the business page's photo skeleton
// would show here.
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-prose flex-col gap-8 px-4 pt-4 pb-12 md:pt-8"
      aria-busy="true"
    >
      <Skeleton className="h-9 w-48" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}
