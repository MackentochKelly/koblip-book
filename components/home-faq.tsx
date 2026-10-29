import {
  HOME_SECTION_IDS,
  homeSectionTitleClassName,
} from "@/components/home-section-title"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { Messages } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// The home page's short questions, one open at a time (shadcn Accordion).
export function HomeFaq({ words }: { words: Messages["home"]["faq"] }) {
  return (
    <section
      id={HOME_SECTION_IDS.faq}
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-2 pb-12 sm:px-4"
    >
      <h2 className={cn(homeSectionTitleClassName, "px-2")}>{words.title}</h2>
      <Accordion>
        {words.items.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionContent>
              <p className="pb-4 text-muted-foreground">{item.a}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
