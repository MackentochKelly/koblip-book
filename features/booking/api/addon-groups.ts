import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  serviceAddonGroups,
} from "@/lib/db/schema"
import type { CheckAddonGroup } from "../utils/addons"

// The add-on groups linked to one service, in group then option order,
// shaped for checkAddons.
export async function loadGroupsForService(
  businessId: string,
  serviceId: string
): Promise<CheckAddonGroup[]> {
  const [groupRows, optionRows, linkRows] = await Promise.all([
    db
      .select()
      .from(addonGroups)
      .where(eq(addonGroups.businessId, businessId))
      .orderBy(asc(addonGroups.position)),
    db
      .select()
      .from(addonOptions)
      .where(eq(addonOptions.businessId, businessId))
      .orderBy(asc(addonOptions.position)),
    db
      .select()
      .from(serviceAddonGroups)
      .where(eq(serviceAddonGroups.businessId, businessId)),
  ])
  const linked = new Set(
    linkRows
      .filter((link) => link.serviceId === serviceId)
      .map((link) => link.groupId)
  )
  return groupRows
    .filter((group) => linked.has(group.id))
    .map((group) => ({
      id: group.id,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: optionRows
        .filter((option) => option.groupId === group.id)
        .map((option) => ({
          id: option.id,
          name: option.name,
          priceMinor: option.priceMinor,
          durationMinutes: option.durationMinutes,
        })),
    }))
}
