"use client"

import { useTranslations } from "next-intl"

import { useHomeLook } from "@/components/home-look"
import { HOME_SECTION_IDS, HomeBigTitle } from "@/components/home-section-title"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

// The questions, in order.
const QUESTIONS = ["free", "start", "who", "app", "change", "spanish"] as const

// The home page's short questions, one open at a time (shadcn Accordion),
// each in its own soft card. On computers the big title sits on the left
// and stays while the questions scroll by on the right, so each row keeps
// a comfortable width; phones stack them.
// The "bands" look: the questions in one card (the stock Accordion, a
// line between questions).
export function HomeFaq() {
  const t = useTranslations("public.home.faq")
  const oneCard = useHomeLook() === "bands"
  return (
    <section
      id={HOME_SECTION_IDS.faq}
      className="mx-auto flex w-full max-w-page flex-col gap-4 px-2 sm:px-4 md:grid md:grid-cols-[1fr_2fr] md:gap-12"
    >
      {/* Below the sticky header while it stays. */}
      <div className="md:sticky md:top-24 md:self-start">
        <HomeBigTitle
          start={t("titleStart")}
          end={t("titleEnd")}
          line={t("subtitle")}
          beside
        />
      </div>
      {/* The first question starts open. Each question is known by its
          place, the same in every language, so switching language keeps
          the open one open. */}
      <Accordion
        defaultValue={[0]}
        className={cn(
          oneCard ? "bg-card" : "gap-3 overflow-visible rounded-none border-0"
        )}
      >
        {QUESTIONS.map((question, index) => (
          <AccordionItem
            key={index}
            value={index}
            className={cn(!oneCard && "rounded-2xl border")}
          >
            <AccordionTrigger className="py-5 text-base hover:no-underline">
              {t(`items.${question}.q`)}
            </AccordionTrigger>
            <AccordionContent>
              <p className="pb-4 text-base text-muted-foreground">{t(`items.${question}.a`)}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
