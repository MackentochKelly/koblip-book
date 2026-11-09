import { BusinessTheme } from "@/components/business-theme"
import { getBusinessThemeBySlug } from "@/lib/business-theme"

// Every page of one business (its page, booking, team and policies) wears
// the look that business picked.
export default async function BusinessPagesLayout({
  params,
  children,
}: LayoutProps<"/b/[slug]">) {
  const { slug } = await params
  return (
    <>
      <BusinessTheme theme={await getBusinessThemeBySlug(slug)} />
      {children}
    </>
  )
}
