import Link from "next/link"

import { glassFrameClassName } from "@/components/glass-frame"
import { homeSectionTitleClassName } from "@/components/home-section-title"
import { Button } from "@/components/ui/button"
import { ExternalLinkIcon } from "@/components/ui/icons"
import type { Messages } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// A real business page, live, on the home page (`href`): the page
// customers see, so it always matches the app. Computers: the page in a
// phone-sized glass frame. Phones: a phone inside a phone is too small, so
// a button opens it.
export function LiveExample({
  href,
  words,
}: {
  href: string
  words: Messages["home"]["live"]
}) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-2 pb-12 sm:px-4">
      <h2 className={cn(homeSectionTitleClassName, "px-2")}>{words.title}</h2>
      <div className="hidden justify-center md:flex">
        <div className={cn(glassFrameClassName, "w-auto")}>
          <iframe
            src={href}
            title={words.frameTitle}
            loading="lazy"
            className="block h-[min(50rem,80dvh)] w-sm rounded-4xl bg-background"
          />
        </div>
      </div>
      <Button
        className="mx-2 md:hidden"
        nativeButton={false}
        render={<Link href={href} />}
      >
        {words.open}
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
    </section>
  )
}
