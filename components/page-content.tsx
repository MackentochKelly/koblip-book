import { cn } from "@/lib/utils"

// The content area of an app page, beside the sidebar and under the top bar:
// one width and padding for every page, owner and admin alike.
export function PageContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-page p-4 md:p-8", className)}
      {...props}
    />
  )
}
