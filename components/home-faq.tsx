"use client"

import { useHomeLook } from "@/components/home-look"
import {
  HOME_SECTION_IDS,
  homeSectionSpaceClassName,
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
// The "bands" look: the title and a line on the left, the questions on
// the right in one card (the stock Accordion, a line between questions).
export function HomeFaq({ words }: { words: Messages["home"]["faq"] }) {
  const sideBySide = useHomeLook() === "bands"
  return (
    <section
      id={HOME_SECTION_IDS.faq}
      className={cn(
        "mx-auto flex w-full max-w-page flex-col gap-8 px-2 sm:px-4",
        homeSectionSpaceClassName,
        sideBySide && "md:grid md:grid-cols-[1fr_2fr] md:gap-12"
      )}
    >
      <div className="flex flex-col gap-1 px-2">
        <h2 className={homeSectionTitleClassName}>{words.title}</h2>
        {sideBySide && (
          <p className="text-muted-foreground">{words.subtitle}</p>
        )}
      </div>
      {/* The first question starts open. */}
      <Accordion
        defaultValue={words.items.slice(0, 1).map((item) => item.q)}
        className={cn(
          sideBySide
            ? "bg-card"
            : "gap-3 overflow-visible rounded-none border-0"
        )}
      >
        {words.items.map((item) => (
          <AccordionItem
            key={item.q}
            value={item.q}
            className={cn(!sideBySide && "rounded-2xl border")}
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
