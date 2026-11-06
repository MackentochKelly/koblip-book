import { useLocale, useTranslations } from "next-intl"

import type { AdminOverview } from "../api/queries"
import { StatStrip } from "@/components/stat-strip"
import {
  CalendarIcon,
  SparklesIcon,
  StoreIcon,
  UsersIcon,
} from "@/components/ui/icons"

// The four app-wide counts.
export function OverviewCards({ overview }: { overview: AdminOverview }) {
  const t = useTranslations("admin.overview")
  const number = new Intl.NumberFormat(useLocale())
  return (
    <StatStrip
      stats={[
        {
          icon: <StoreIcon />,
          tone: "primary",
          label: t("businesses"),
          value: number.format(overview.businesses),
        },
        {
          icon: <UsersIcon />,
          tone: "info",
          label: t("owners"),
          value: number.format(overview.owners),
        },
        {
          icon: <CalendarIcon />,
          tone: "success",
          label: t("bookings"),
          value: number.format(overview.bookings),
        },
        {
          icon: <SparklesIcon />,
          tone: "warning",
          label: t("newOwners"),
          value: number.format(overview.newOwners),
        },
      ]}
    />
  )
}
