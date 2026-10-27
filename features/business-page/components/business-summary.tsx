import { VerifiedBadge } from "@/components/verified-badge"
import type { Business } from "../types"
import { BusinessAddress, BusinessWebsite } from "./business-address"
import { BusinessFacts } from "./business-facts"

// Who it is at a glance: name, kind, rating, open now, and where.
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
        <VerifiedBadge className="ml-1 align-[-0.2em]" />
      </h1>
      {business.category && (
        <p className="text-sm text-muted-foreground">{business.category}</p>
      )}
      <BusinessFacts business={business} open={open} />
      {business.address && (
        <BusinessAddress>{business.address}</BusinessAddress>
      )}
      {business.website && <BusinessWebsite url={business.website} />}
    </header>
  )
}
