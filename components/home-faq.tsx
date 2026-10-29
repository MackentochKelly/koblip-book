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

// The home page's short questions, one open at a time (shadcn Accordion),
// each in its own soft card.
export function HomeFaq({ words }: { words: Messages["home"]["faq"] }) {
  return (
    <section
      id={HOME_SECTION_IDS.faq}
      className="mx-auto flex w-full max-w-page flex-col gap-4 px-2 pb-12 sm:px-4"
    >
      <h2 className={cn(homeSectionTitleClassName, "px-2")}>{words.title}</h2>
      {/* The first question starts open. */}
      <Accordion
        defaultValue={words.items.slice(0, 1).map((item) => item.q)}
        className="gap-3 overflow-visible rounded-none border-0"
      >
        {words.items.map((item) => (
          <AccordionItem
            key={item.q}
            value={item.q}
            className="rounded-2xl border"
          >
            <AccordionTrigger className="py-5 text-base hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent>
              <p className="pb-4 text-base text-muted-foreground">{item.a}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
