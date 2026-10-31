import "server-only"

import { and, desc, eq, gt } from "drizzle-orm"
import {
  addDays,
  weekdayOf,
  zonedInstant,
  zonedToday,
} from "@/features/booking/utils/zoned-time"
import { customerKey } from "@/lib/customer-key"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  bookings,
  businesses,
  businessHours,
  businessPhotos,
  services,
  teamMemberServices,
  teamMemberHours,
  teamMembers,
} from "@/lib/db/schema"
import { DEMO_RULES } from "@/lib/demo-rules"
import { DEMO_SAMPLE } from "../sample"

export interface DemoCopy {
  id: string
  slug: string
}

function keepCutoff(now: number): string {
  return new Date(now - DEMO_RULES.keepHours * 3_600_000).toISOString()
}

function minuteOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

// The visitor's own copy, while it is still kept; null once it is gone.
export async function findDemoCopy(
  ownerId: string,
  now: number = Date.now()
): Promise<DemoCopy | null> {
  const [row] = await db
    .select({ id: businesses.id, slug: businesses.slug })
    .from(businesses)
    .where(
      and(
        eq(businesses.ownerId, ownerId),
        eq(businesses.isDemo, true),
        gt(businesses.createdAt, keepCutoff(now))
      )
    )
    .orderBy(desc(businesses.createdAt))
    .limit(1)
  return row ?? null
}

// A new, full copy of DEMO_SAMPLE owned by `ownerId`, written all at once.
export async function createDemoCopy(
  ownerId: string,
  now: number = Date.now()
): Promise<DemoCopy> {
  const sample = DEMO_SAMPLE
  const businessId = crypto.randomUUID()
  const slug = `${sample.slugPrefix}-${businessId.slice(0, 8)}`
  const serviceIds = sample.services.map(() => crypto.randomUUID())
  const memberIds = sample.team.map(() => crypto.randomUUID())
  const today = zonedToday(now, sample.timezone)

  const bookingRows = sample.bookings.flatMap((booking) => {
    const date = addDays(today, booking.day)
    if (!sample.hours.some((day) => day.weekday === weekdayOf(date))) {
      return []
    }
    const service = sample.services[booking.service]
    const start = zonedInstant(date, minuteOfDay(booking.time), sample.timezone)
    const customerName = sample.customers[booking.customer]
    return [
      {
        businessId,
        serviceId: serviceIds[booking.service],
        teamMemberId: memberIds[booking.member],
        serviceName: service.name,
        teamMemberName: sample.team[booking.member].name,
        durationMinutes: service.durationMinutes,
        priceMinor: service.priceMinor,
        currency: sample.currency,
        startAt: new Date(start).toISOString(),
        endAt: new Date(start + service.durationMinutes * 60_000).toISOString(),
        customerName,
        customerPhone: null,
        customerKey: customerKey(null, customerName),
        source: "online",
      },
    ]
  })

  const memberHours = sample.team.flatMap((member, index) => member.hours.map((row) => ({ ...row, businessId, teamMemberId: memberIds[index] })))
  await saveAll([
    db.insert(businesses).values({
      id: businessId,
      slug,
      name: sample.name,
      description: sample.description,
      address: sample.address,
      timezone: sample.timezone,
      currency: sample.currency,
      category: sample.category,
      status: "operational",
      ownerId,
      // Its details are the sample's own: nothing for the guest to confirm.
      detailsConfirmedAt: now,
      seats: sample.seats,
      isDemo: true,
    }),
    db
      .insert(businessHours)
      .values(sample.hours.map((day) => ({ businessId, ...day }))),
    db
      .insert(businessPhotos)
      .values(
        sample.photos.map((url, position) => ({ businessId, url, position }))
      ),
    db.insert(services).values(
      sample.services.map((service, index) => ({
        id: serviceIds[index],
        businessId,
        ...service,
        position: index,
      }))
    ),
    db.insert(teamMembers).values(
      sample.team.map((member, index) => ({
        id: memberIds[index],
        businessId,
        name: member.name,
        position: index,
      }))
    ),
    ...(memberHours.length ? [db.insert(teamMemberHours).values(memberHours)] : []),
    db.insert(teamMemberServices).values(
      sample.team.flatMap((member, index) =>
        member.services.map((service) => ({
          businessId,
          teamMemberId: memberIds[index],
          serviceId: serviceIds[service],
        }))
      )
    ),
    ...(bookingRows.length > 0
      ? [db.insert(bookings).values(bookingRows)]
      : []),
  ])
  return { id: businessId, slug }
}
