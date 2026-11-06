import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { AdminCategoryBusiness } from "../api/queries"
import type { AdminMessages } from "../i18n"
import { AdminDeleteButton } from "./admin-delete-button"

// Each business's service categories in its order, with how many services
// each holds, and Delete (onDelete comes from the page): the services move
// to Other.
export function ServiceCategoriesList({
  businesses,
  m,
  onDelete,
}: {
  businesses: AdminCategoryBusiness[]
  m: AdminMessages
  onDelete: (categoryId: string) => Promise<{ ok: boolean }>
}) {
  const t = m.serviceCategories
  return (
    <div className="flex flex-col gap-8">
      {businesses.map((business) => (
        <section key={business.id} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {business.name}
          </h2>
          <ItemGroup className="gap-3">
            {business.categories.map((category) => (
              <Item key={category.id} variant="outline">
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full">
                    <span className="truncate">{category.name}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate">
                    {t.services(category.services)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <AdminDeleteButton
                    name={category.name}
                    description={t.movesToOther}
                    onDelete={onDelete.bind(null, category.id)}
                  />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </section>
      ))}
    </div>
  )
}
