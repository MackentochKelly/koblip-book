import { CalendarDaysIcon } from "@/components/ui/icons"
import { getBookings } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { BookingsList } from "@/features/admin/components/bookings-list"
import { getAdminMessages } from "@/features/admin/i18n/server"

export default async function AdminBookingsPage() {
  const [bookings, m] = await Promise.all([getBookings(), getAdminMessages()])
  return (
    <AdminPage
      title={m.nav.bookings}
      icon={<CalendarDaysIcon />}
      empty={bookings.length ? null : m.bookings.none}
    >
      <BookingsList bookings={bookings} m={m} />
    </AdminPage>
  )
}
