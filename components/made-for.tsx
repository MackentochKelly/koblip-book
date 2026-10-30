import {
  HomeRowLabel,
  homeSectionSpaceClassName,
} from "@/components/home-section-title"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CarFrontIcon,
  DumbbellIcon,
  FlowerIcon,
  GraduationCapIcon,
  HandHeartIcon,
  PawPrintIcon,
  SmileIcon,
  SparklesIcon,
  StethoscopeIcon,
  WrenchIcon,
  type Icon,
} from "@/components/ui/icons"
import { Marquee } from "@/components/ui/marquee"
import { messagesFor, type Messages } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"

type Kind = Exclude<keyof Messages["home"]["madeFor"], "title" | "more">

// The kinds of business shown, in order, each with its icon. Any business
// clients book with can use Koblip Book; these are only examples.
const KINDS: [Kind, Icon][] = [
  ["clinics", StethoscopeIcon],
  ["dentists", SmileIcon],
  ["beauty", SparklesIcon],
  ["spas", FlowerIcon],
  ["fitness", DumbbellIcon],
  ["therapists", HandHeartIcon],
  ["tutors", GraduationCapIcon],
  ["petCare", PawPrintIcon],
  ["carCare", CarFrontIcon],
  ["repairs", WrenchIcon],
]

// "Made for": a row of business kinds sliding slowly sideways (Magic UI's
// Marquee), stopping under the mouse, so a visitor sees early that it is
// for them. Right under "Works with" and quiet like it, but moving chips,
// not still logos. Reduce Motion: one still copy, wrapped onto more lines.
// Screen readers get the plain list once, not the sliding copies.
export function MadeFor({ language }: { language: PageLanguage }) {
  const t = messagesFor(language).home.madeFor
  const chips = KINDS.map(([kind, KindIcon]) => (
    <Badge
      key={kind}
      variant="outline"
      className="h-9 gap-2 px-4 text-sm [&>svg]:size-4!"
    >
      <KindIcon />
      {t[kind]}
    </Badge>
  ))
  return (
    <section className={cn(
        "mx-auto flex w-full max-w-page flex-col items-center gap-6",
        homeSectionSpaceClassName
      )}>
      <HomeRowLabel>{t.title}</HomeRowLabel>
      <ul className="sr-only">
        {KINDS.map(([kind]) => (
          <li key={kind}>{t[kind]}</li>
        ))}
        <li>{t.more}</li>
      </ul>
      <Marquee
        aria-hidden
        pauseOnHover
        className="w-full [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)] [--duration:50s] motion-reduce:justify-center motion-reduce:[mask-image:none] motion-reduce:px-4 motion-reduce:*:animate-none motion-reduce:*:flex-wrap motion-reduce:*:justify-center motion-reduce:*:not-first:hidden"
      >
        {chips}
      </Marquee>
    </section>
  )
}
