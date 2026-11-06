"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"

import { type Owner } from "@/components/account-menu"
import { AppShell } from "@/components/app-shell"
import { PhotoWordsProvider } from "@/components/photo-upload"
import { StoreIcon } from "@/components/ui/icons"
import { UPLOAD_RULES } from "@/lib/upload-rules"
import {
  ACCOUNT_SETTINGS_PATH,
  MY_BOOKINGS_PATH,
} from "@/lib/my-bookings-links"
import { ACCOUNT_NAV } from "../nav"

// The client's own area in the app's shared frame (AppShell), with the
// account menu at the foot of the menu.
export function AccountShell({
  account,
  ownsBusiness,
  bell,
  children,
}: {
  account: Owner
  // An owner too: the account menu leads back to their business.
  ownsBusiness: boolean
  // The client's notifications, in the top bar.
  bell?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const t = useTranslations("public.account")
  const owner = useTranslations("owner")
  const photos = useTranslations("owner.settings.photos")
  const items = ACCOUNT_NAV.map((item) => ({
    href: item.href,
    label: t(`nav.${item.key}`),
    icon: item.icon,
    // Bookings is the area's first page; its reschedule pages are under it.
    active:
      item.href === MY_BOOKINGS_PATH
        ? pathname === item.href ||
          pathname.startsWith(`${MY_BOOKINGS_PATH}/reschedule`)
        : pathname.startsWith(item.href),
  }))
  return (
    <AppShell
      title={t("area")}
      items={items}
      menuLabel={t("menu")}
      account={account}
      settingsHref={ACCOUNT_SETTINGS_PATH}
      bell={bell}
      accountLinks={
        ownsBusiness
          ? [
              {
                href: "/dashboard",
                label: t("myBusiness"),
                icon: <StoreIcon />,
              },
            ]
          : undefined
      }
    >
      {/* The photo buttons' words, the owner area's. */}
      <PhotoWordsProvider
        words={{
          change: photos("change"),
          addPhoto: photos("addPhoto"),
          remove: photos("remove"),
          errors: {
            not_found: owner("settings.tryAgain"),
            missing: photos("pick"),
            too_big: photos("tooBig"),
            wrong_type: photos("wrongType"),
            limit: photos("limit", { max: UPLOAD_RULES.maxBusinessPhotos }),
          },
        }}
      >
        {children}
      </PhotoWordsProvider>
    </AppShell>
  )
}
