// Helpers for "a service with NO team_member_services rows is done by
// everyone on the team; a service with rows is done only by those members".

export interface ServiceLink {
  serviceId: string
  teamMemberId: string
}

export interface TakenBooking {
  startAt: string
  endAt: string
  teamMemberId: string | null
}

// Member ids in position order, narrowed to the members who can do the
// service. Busy times are NOT filtered here: they still come from all
// bookings of the business.
export function allowedServiceMemberIds(
  teamIdsInOrder: string[],
  links: ServiceLink[],
  serviceId: string
): string[] {
  const forService = links.filter((link) => link.serviceId === serviceId)
  if (forService.length === 0) {
    return [...teamIdsInOrder]
  }
  const allowed = new Set(forService.map((link) => link.teamMemberId))
  return teamIdsInOrder.filter((id) => allowed.has(id))
}

export function firstFreeMember<T extends { id: string }>(
  membersInOrder: T[],
  taken: TakenBooking[],
  startInstant: number,
  endInstant: number
): T | null {
  return (
    membersInOrder.find(
      (row) =>
        !taken.some(
          (booking) =>
            booking.teamMemberId === row.id &&
            Date.parse(booking.startAt) < endInstant &&
            Date.parse(booking.endAt) > startInstant
        )
    ) ?? null
  )
}
