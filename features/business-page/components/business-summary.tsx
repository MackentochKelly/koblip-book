import type { Business } from "../types"
import { BusinessAddress } from "./business-address"
import { BusinessStatus } from "./business-status"

// Who it is at a glance: name, open now, and where.
export function BusinessSummary({
  business,
  open,
}: {
  business: Business
  open: boolean | null
}) {
  return (
    <header className="flex min-w-0 flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
        {business.name}
      </h1>
      {open !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <BusinessStatus open={open} />
        </div>
      )}
      {business.address && (
        <BusinessAddress className="mt-1">{business.address}</BusinessAddress>
      )}
    </header>
  )
}
