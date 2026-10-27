"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  MapPinIcon,
  PhoneIcon,
  StoreIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { confirmBusinessDetails } from "../api/actions"

export interface ImportedDetails {
  name: string
  category: string | null
  phone: string | null
  address: string | null
  website: string | null
  // Days of the week with opening hours.
  openDays: number
}

// Shown on the dashboard until the owner confirms what came from Google
// Maps. Once confirmed, the details are the owner's own (Google's terms
// don't let us keep Google's copy). Saving details or hours confirms too.
export function ConfirmDetailsCard({
  businessId,
  details,
}: {
  businessId: string
  details: ImportedDetails
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const base = `/dashboard/${businessId}`

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmBusinessDetails(businessId)
      if (result.ok) {
        toast.success("Details confirmed")
        router.refresh()
      } else {
        toast.error("Could not confirm. Try again.")
      }
    })

  const rows = [
    {
      icon: StoreIcon,
      value: details.category
        ? `${details.name} · ${details.category}`
        : details.name,
    },
    { icon: PhoneIcon, value: details.phone },
    { icon: MapPinIcon, value: details.address },
    { icon: GlobeIcon, value: details.website },
  ].filter((row): row is { icon: typeof StoreIcon; value: string } =>
    Boolean(row.value)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your details</CardTitle>
        <CardDescription>From Google Maps. Is this right?</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-1">
          {rows.map(({ icon: Icon, value }) => (
            <Item key={value} size="sm" className="px-0 py-1.5">
              <ItemMedia variant="icon">
                <Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="font-normal wrap-break-word">
                  {value}
                </ItemTitle>
              </ItemContent>
            </Item>
          ))}
          <Item
            size="sm"
            className="px-0 py-1.5"
            render={<Link href={`${base}/hours`} />}
          >
            <ItemMedia variant="icon">
              <ClockIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="font-normal">
                {details.openDays === 0
                  ? "No opening hours"
                  : `Open ${details.openDays} ${details.openDays === 1 ? "day" : "days"} a week`}
              </ItemTitle>
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        </ItemGroup>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`${base}/settings`} />}
        >
          Edit
        </Button>
        <Button onClick={confirm} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Looks right
        </Button>
      </CardFooter>
    </Card>
  )
}
