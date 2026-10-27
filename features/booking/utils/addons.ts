export interface CheckAddonOption {
  id: string
  name: string
  priceMinor: number | null
  durationMinutes: number
}

export interface CheckAddonGroup {
  id: string
  minSelect: number
  maxSelect: number | null
  options: CheckAddonOption[]
}

export type CheckAddonsResult =
  | {
      ok: true
      options: CheckAddonOption[]
      extraMinutes: number
      extraPriceMinor: number | null
    }
  | { ok: false }

// Pure check for the add-ons a customer picked for one service.
// groupsForService holds only the groups linked to that service.
// Every id must be an option of one of those groups, no duplicates,
// and each group's picked count must sit within minSelect..maxSelect
// (a null maxSelect means no limit). extraPriceMinor is null only when
// no picked option has a price; otherwise a null option price counts
// as 0. The chosen options come back in group then option order.
export function checkAddons(
  groupsForService: CheckAddonGroup[],
  addonIds: string[]
): CheckAddonsResult {
  if (!Array.isArray(addonIds)) {
    return { ok: false }
  }
  const seen = new Set<string>()
  for (const id of addonIds) {
    if (typeof id !== "string" || seen.has(id)) {
      return { ok: false }
    }
    seen.add(id)
  }
  const byId = new Map<string, CheckAddonOption>()
  for (const group of groupsForService) {
    for (const option of group.options) {
      byId.set(option.id, option)
    }
  }
  for (const id of addonIds) {
    if (!byId.has(id)) {
      return { ok: false }
    }
  }
  const chosen: CheckAddonOption[] = []
  for (const group of groupsForService) {
    const picked = group.options.filter((option) => seen.has(option.id))
    if (picked.length < group.minSelect) {
      return { ok: false }
    }
    if (group.maxSelect !== null && picked.length > group.maxSelect) {
      return { ok: false }
    }
    chosen.push(...picked)
  }
  let extraMinutes = 0
  let extraPriceMinor: number | null = null
  for (const option of chosen) {
    extraMinutes += option.durationMinutes
    if (option.priceMinor !== null) {
      extraPriceMinor = (extraPriceMinor ?? 0) + option.priceMinor
    }
  }
  return { ok: true, options: chosen, extraMinutes, extraPriceMinor }
}
