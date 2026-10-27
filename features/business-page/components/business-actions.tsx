import { GlobeIcon, NavigationIcon, PhoneCallIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Business } from "../types"
import { directionsUrl } from "../utils/directions-url"

// Directions, call and website: only what the business has. A row on the phone bar,
// stacked in the side card.
export function BusinessActions({
  business,
  layout,
}: {
  business: Business
  layout: "row" | "stack"
}) {
  const directions = directionsUrl(business)
  const wide = layout === "row" ? "flex-1" : "w-full"
  return (
    <div className={cn("flex gap-2", layout === "row" ? "w-full" : "flex-col")}>
      {directions && (
        <Button
          variant="outline"
          size="lg"
          className={wide}
          nativeButton={false}
          render={<a href={directions} target="_blank" rel="noreferrer" />}
        >
          <NavigationIcon />
          Directions
        </Button>
      )}
      {business.phone && (
        <Button
          size="lg"
          className={wide}
          nativeButton={false}
          render={<a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} />}
        >
          <PhoneCallIcon />
          Call
        </Button>
      )}
      {layout === "stack" && business.website && (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          nativeButton={false}
          render={
            <a href={business.website} target="_blank" rel="noreferrer" />
          }
        >
          <GlobeIcon />
          Website
        </Button>
      )}
    </div>
  )
}

export function hasActions(business: Business): boolean {
  return Boolean(directionsUrl(business) || business.phone)
}
