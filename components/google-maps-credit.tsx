import Image from "next/image"

import { cn } from "@/lib/utils"

// Google's own "Google Maps" logo, required wherever Google Places data shows
// without a Google map: the file from Google's attribution pack, unchanged,
// 16px tall, with 10px clear space on the sides and top and 5px below
// (developers.google.com/maps/documentation/places/web-service/policies).
// Grey on light screens, white on dark.
export function GoogleMapsCredit({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 px-2.5 pt-2.5 pb-1.5", className)}
    >
      <Image
        src="/brands/google-maps-logo-gray.svg"
        alt="Google Maps"
        width={87}
        height={16}
        unoptimized
        className="dark:hidden"
      />
      <Image
        src="/brands/google-maps-logo-white.svg"
        alt="Google Maps"
        width={87}
        height={16}
        unoptimized
        className="hidden dark:block"
      />
    </span>
  )
}
