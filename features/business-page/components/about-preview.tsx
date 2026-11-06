"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

// The first two lines of About under the name, with a jump to the rest.
export function AboutPreview({ text }: { text: string }) {
  const t = useTranslations("public.page")
  return (
    <div className="-mt-4 flex flex-col items-start">
      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 dark:text-foreground"
        onClick={() =>
          document
            .getElementById("about")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      >
        {t("viewMore")}
      </Button>
    </div>
  )
}
