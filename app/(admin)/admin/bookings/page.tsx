import { getTranslations } from "next-intl/server"

import { CalendarDaysIcon } from "@/components/ui/icons"
import { getBookings } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { BookingsList } from "@/features/admin/components/bookings-list"

export default async function AdminBookingsPage() {
  const [bookings, t] = await Promise.all([
    getBookings(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.bookings")}
      icon={<CalendarDaysIcon />}
      empty={bookings.length ? null : t("bookings.none")}
    >
      <BookingsList bookings={bookings} />
    </AdminPage>
  )
}
