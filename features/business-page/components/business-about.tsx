import { PageSection } from "@/components/page-section"
export function BusinessAbout({ description }: { description: string | null }) {
  if (!description) {
    return null
  }
  return (
    <PageSection id="about" title="About">
      <p className="text-sm leading-relaxed whitespace-pre-line">
        {description}
      </p>
    </PageSection>
  )
}
