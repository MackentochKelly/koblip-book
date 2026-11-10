"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import { useTranslations } from "next-intl"
import { SectionParts } from "@/components/section-parts"
import type { PlanFeatureKey } from "@/lib/plan-features"
import type { LockedPlans } from "../types"

// Settings' parts, in order. Details is the page itself; each other part is
// its own route below it (app/(owner)/dashboard/[businessId]/settings/).
const PARTS = [
  "details",
  "hours",
  "portfolio",
  "policies",
  "payments",
  "theme",
  "notifications",
  "plan",
  "account",
] as const

type Part = (typeof PARTS)[number]

// The plan feature a part needs (docs/plans/subscriptions.md, P5e).
const PART_FEATURES: Partial<Record<Part, PlanFeatureKey>> = {
  theme: "pageThemes",
}

// Settings' frame around its parts: the shared SectionParts, as on
// Automations (D19): a row of tabs, pinned under the top bar on a phone.
// No title on the page: the top bar and the menu already name it. Plan
// shows once billing is set up (lib/stripe.ts).
export function SettingsFrame({
  businessId,
  lockedPlans,
  billing,
  children,
}: {
  businessId: string
  lockedPlans: LockedPlans
  billing: boolean
  children: React.ReactNode
}) {
  const t = useTranslations("owner.settings")
  const plans = useTranslations("app.planLocked.plans")
  const shell = useTranslations("owner.shell")
  const segment = useSelectedLayoutSegment()
  const base = `/dashboard/${businessId}/settings`
  const hrefOf = (part: Part) => (part === "details" ? base : `${base}/${part}`)
  const part = PARTS.find((item) => item === segment) ?? "details"
  const lockedBadge = (feature: PlanFeatureKey | undefined) => {
    const needs = feature ? lockedPlans[feature] : undefined
    return needs ? plans(needs) : undefined
  }

  return (
    <SectionParts
      title={shell("nav.settings")}
      titleHidden
      parts={PARTS.filter((item) => billing || item !== "plan").map((item) => ({
        id: item,
        label: t(`parts.${item}`),
        href: hrefOf(item),
        badge: lockedBadge(PART_FEATURES[item]),
      }))}
      current={part}
      ariaLabel={t("partsLabel")}
    >
      {children}
    </SectionParts>
  )
}
