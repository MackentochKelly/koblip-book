import { SearchXIcon } from "@/components/ui/icons"
import { PageNotice } from "@/components/page-notice"

export default function NotFound() {
  return (
    <PageNotice
      icon={<SearchXIcon />}
      title="This page does not exist"
      description="Check the link you received, or ask the business for a new one."
    />
  )
}
