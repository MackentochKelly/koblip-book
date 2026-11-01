import { cn } from "@/lib/utils"

// The content area of an app page, beside the sidebar and under the top bar:
// one width and padding for every page, owner and admin alike. A page that
// fills the whole area itself (the assistant's chat) passes `fill`.
export function PageContent({
  fill = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { fill?: boolean }) {
  return (
    <div
      className={cn(
        fill
          ? "flex min-h-0 w-full flex-1 flex-col"
          : "mx-auto w-full max-w-page p-4 md:p-8",
        className
      )}
      {...props}
    />
  )
}
