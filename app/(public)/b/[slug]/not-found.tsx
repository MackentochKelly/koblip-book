import { useTranslations } from "next-intl"

import { SearchXIcon } from "@/components/ui/icons"
import { PageNotice } from "@/components/page-notice"

export default function NotFound() {
  const t = useTranslations("public.page.notFound")
  return (
    <PageNotice
      icon={<SearchXIcon />}
      title={t("title")}
      description={t("text")}
    />
  )
}
