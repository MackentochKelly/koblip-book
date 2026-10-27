// Pure planning helpers. They compute the rows that the actions in api/team-services.ts must
// write, so the "everyone" rules are testable without a database.

export function planServiceTeamRows(
  allTeamMemberIds: string[],
  teamMemberIds: string[]
): { ok: true; rows: string[] } | { ok: false; error: "invalid" } {
  if (!Array.isArray(teamMemberIds)) {
    return { ok: false, error: "invalid" }
  }
  const all = new Set(allTeamMemberIds)
  const seen = new Set<string>()
  for (const id of teamMemberIds) {
    if (typeof id !== "string" || !all.has(id) || seen.has(id)) {
      return { ok: false, error: "invalid" }
    }
    seen.add(id)
  }
  // An empty list, or a list with every team member, means everyone: no rows.
  if (teamMemberIds.length === 0 || seen.size === all.size) {
    return { ok: true, rows: [] }
  }
  return { ok: true, rows: [...teamMemberIds] }
}

export interface MemberServicesPlan {
  serviceIds: string[]
  teamMemberIds: string[]
  currentRows: Record<string, string[]>
  teamMemberId: string
  serviceIdsWanted: string[]
}

export function planMemberServiceRows(
  plan: MemberServicesPlan
):
  | { ok: true; rows: Record<string, string[]> }
  | { ok: false; error: "invalid" | "last_member" } {
  const { serviceIds, teamMemberIds, currentRows, teamMemberId, serviceIdsWanted } =
    plan
  if (
    !Array.isArray(serviceIds) ||
    !Array.isArray(teamMemberIds) ||
    !Array.isArray(serviceIdsWanted) ||
    !currentRows ||
    typeof currentRows !== "object" ||
    !teamMemberIds.includes(teamMemberId)
  ) {
    return { ok: false, error: "invalid" }
  }
  const knownServices = new Set(serviceIds)
  const knownMembers = new Set(teamMemberIds)
  const wanted = new Set<string>()
  for (const id of serviceIdsWanted) {
    if (typeof id !== "string" || !knownServices.has(id) || wanted.has(id)) {
      return { ok: false, error: "invalid" }
    }
    wanted.add(id)
  }
  for (const [serviceId, memberIds] of Object.entries(currentRows)) {
    if (!knownServices.has(serviceId) || !Array.isArray(memberIds)) {
      return { ok: false, error: "invalid" }
    }
    const seen = new Set<string>()
    for (const id of memberIds) {
      if (!knownMembers.has(id) || seen.has(id)) {
        return { ok: false, error: "invalid" }
      }
      seen.add(id)
    }
  }
  const rows: Record<string, string[]> = {}
  for (const serviceId of serviceIds) {
    const current = currentRows[serviceId]
    if (wanted.has(serviceId)) {
      if (current === undefined) {
        continue
      }
      const next = current.includes(teamMemberId)
        ? [...current]
        : [...current, teamMemberId]
      // Rows with every team member mean everyone: no rows.
      if (next.length < teamMemberIds.length) {
        rows[serviceId] = next
      }
    } else {
      if (current === undefined) {
        const others = teamMemberIds.filter((id) => id !== teamMemberId)
        if (others.length === 0) {
          return { ok: false, error: "last_member" }
        }
        if (others.length < teamMemberIds.length) {
          rows[serviceId] = others
        }
      } else {
        const next = current.filter((id) => id !== teamMemberId)
        if (next.length === 0) {
          return { ok: false, error: "last_member" }
        }
        if (next.length < teamMemberIds.length) {
          rows[serviceId] = next
        }
      }
    }
  }
  return { ok: true, rows }
}
