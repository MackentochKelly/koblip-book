import Link from "next/link"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { ACCOUNT_ADD_PHONE_PATH } from "@/lib/my-bookings-links"

// An empty client page (D14): its title and one action, adding the phone
// the client books with so those bookings show (`addPhone`: the account has
// none and codes can be sent).
export function AccountEmpty({
  title,
  addPhone,
}: {
  title: string
  addPhone: boolean
}) {
  const t = useTranslations("public.account.profile")
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
      {addPhone && (
        <EmptyContent>
          <Button
            nativeButton={false}
            render={<Link href={ACCOUNT_ADD_PHONE_PATH} />}
          >
            {t("addPhone")}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}
