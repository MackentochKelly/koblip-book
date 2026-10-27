import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Business } from "../types"
import { BusinessActions } from "./business-actions"
import { BusinessFacts } from "./business-facts"
import { LanguageMenu } from "./language-menu"
import { ShareButton } from "./share-button"

// On a computer: the business and its buttons, kept in view beside the page.
export function BusinessSideCard({
  business,
  open,
}: {
  business: Business
  open: boolean | null
}) {
  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-lg">{business.name}</CardTitle>
        {business.category && (
          <CardDescription>{business.category}</CardDescription>
        )}
        <CardAction className="flex gap-2">
          <ThemeToggle size="icon-sm" />
          <LanguageMenu size="icon-sm" />
          <ShareButton title={business.name} size="icon-sm" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <BusinessFacts business={business} open={open} />
        {business.address && (
          <p className="text-sm text-muted-foreground">{business.address}</p>
        )}
        <BusinessActions business={business} layout="stack" />
      </CardContent>
    </Card>
  )
}
