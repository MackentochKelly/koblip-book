import { SidebarInset } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// The app's page beside the sidebar, owner and admin alike: the gray app
// surface (data-surface="app"), on which rows, empty states and choice cards
// are white cards (app/globals.css).
export function AppInset({
  className,
  ...props
}: React.ComponentProps<typeof SidebarInset>) {
  return (
    <SidebarInset
      data-surface="app"
      className={cn("min-w-0 bg-app-background", className)}
      {...props}
    />
  )
}
