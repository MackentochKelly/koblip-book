import { PageSection } from "@/components/page-section"
export function BusinessAbout({ description }: { description: string | null }) {
  if (!description) {
    return null
  }
  return (
    <PageSection title="About">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </PageSection>
  )
}
