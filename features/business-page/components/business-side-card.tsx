import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent } from "@/components/ui/card"
import type { Business } from "../types"
import { BusinessActions } from "./business-actions"
import { LanguageMenu } from "@/components/language-menu"
import { ShareButton } from "./share-button"

// On a computer: the business's buttons, kept in view beside the page. Who it
// is and where stays in the page's own header, so nothing shows twice.
export function BusinessSideCard({
  business,
  bookable,
}: {
  business: Business
  bookable: boolean
}) {
  return (
    <Card className="sticky top-6">
      <CardContent className="flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          <ThemeToggle />
          <LanguageMenu />
          <ShareButton title={business.name} />
        </div>
        <BusinessActions
          business={business}
          layout="stack"
          bookable={bookable}
        />
      </CardContent>
    </Card>
  )
}
