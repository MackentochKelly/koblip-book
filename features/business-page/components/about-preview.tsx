"use client"

import { useMessages } from "@/components/language-provider"
import { Button } from "@/components/ui/button"

// The first two lines of About under the name, with a jump to the rest.
export function AboutPreview({ text }: { text: string }) {
  const m = useMessages()
  return (
    <div className="-mt-4 flex flex-col items-start gap-1">
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
        {m.page.viewMore}
      </Button>
    </div>
  )
}
