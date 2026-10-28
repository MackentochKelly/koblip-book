import { Skeleton } from "@/components/ui/skeleton"

// The page's shape while it loads: photo, name and a few lines.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl md:px-6 md:pt-6" aria-busy="true">
      <Skeleton className="aspect-4/3 w-full rounded-none md:aspect-3/1 md:rounded-xl" />
      <div className="flex flex-col gap-3 px-4 pt-5 md:px-0 md:pt-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
