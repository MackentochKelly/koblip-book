import type { AppSelectOption } from "@/components/app-select"
import { groupServices, showsGroups } from "@/lib/service-groups"

// A service picker's options (add booking, the Services filter, Extras'
// Offered with): in the categories' order, each labelled with its category,
// Other last. A business with no category keeps the flat list it had.
export function serviceSelectOptions<
  S extends { id: string; name: string; categoryId: string | null },
>(
  services: readonly S[],
  // In their saved order.
  categories: readonly { id: string; name: string }[],
  // The label of the services with no category.
  other: string,
  label: (service: S) => string = (service) => service.name
): AppSelectOption[] {
  const groups = groupServices(services, categories)
  const labelled = showsGroups(groups)
  return groups.flatMap((group) =>
    group.services.map((service) => ({
      value: service.id,
      label: label(service),
      group: labelled ? (group.category?.name ?? other) : undefined,
    }))
  )
}
