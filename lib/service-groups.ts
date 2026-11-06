// Services in their categories (docs/plans/service-categories.md), the one
// grouping every screen uses: each category in its order with its services
// in theirs, then Other (no category, or one that is gone) last. Both lists
// come in their saved order, as every query reads them.
// Other's key where a category id goes, like a filter's choice (ids are
// UUIDs, so it never clashes with one).
export const OTHER_GROUP = "other"

export interface ServiceGroup<S, C> {
  // Null for Other.
  category: C | null
  services: S[]
}

export function groupServices<
  S extends { categoryId: string | null },
  C extends { id: string },
>(
  services: readonly S[],
  categories: readonly C[],
  // The owner's screen keeps an empty category to add services to;
  // customers never see one.
  { keepEmpty = false }: { keepEmpty?: boolean } = {}
): ServiceGroup<S, C>[] {
  const known = new Set(categories.map((category) => category.id))
  const groups: ServiceGroup<S, C>[] = categories.map((category) => ({
    category,
    services: services.filter((service) => service.categoryId === category.id),
  }))
  const other = services.filter(
    (service) => service.categoryId === null || !known.has(service.categoryId)
  )
  return [
    ...groups.filter((group) => keepEmpty || group.services.length > 0),
    ...(other.length > 0 ? [{ category: null, services: other }] : []),
  ]
}

// Whether the groups show as groups: only once a category is among them.
// Otherwise the list stays the flat list it was before categories.
export function showsGroups<S, C>(groups: readonly ServiceGroup<S, C>[]) {
  return groups.some((group) => group.category !== null)
}

// The services in the order the groups show them.
export function inGroupOrder<S, C>(groups: readonly ServiceGroup<S, C>[]): S[] {
  return groups.flatMap((group) => group.services)
}
