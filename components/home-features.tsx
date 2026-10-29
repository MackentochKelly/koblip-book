import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  CalendarDaysIcon,
  MapPinIcon,
  SparklesIcon,
} from "@/components/ui/icons"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"

// What an owner gets, under the home hero: only features that work today
// (WhatsApp reminders are "Soon" in WorksWith, so not here).
export function HomeFeatures({ language }: { language: PageLanguage }) {
  const t = messagesFor(language).home.features
  const features = [
    { Icon: MapPinIcon, title: t.page, text: t.pageText },
    { Icon: CalendarDaysIcon, title: t.book, text: t.bookText },
    { Icon: SparklesIcon, title: t.assistant, text: t.assistantText },
  ]
  return (
    <section
      aria-label={t.label}
      className="mx-auto grid w-full max-w-5xl gap-4 px-2 pt-12 sm:grid-cols-3 sm:px-4"
    >
      {features.map(({ Icon, title, text }) => (
        <Card key={title}>
          <CardHeader>
            <Icon className="mb-2 size-6 text-primary" aria-hidden />
            <CardTitle>{title}</CardTitle>
            <CardDescription>{text}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </section>
  )
}
