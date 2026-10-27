"use client"

import { Button } from "@/components/ui/button"

// The first two lines of About under the name, with a jump to the rest.
export function AboutPreview({ text }: { text: string }) {
  return (
    <div className="-mt-4 flex flex-col items-start gap-1">
      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0"
        onClick={() =>
          document
            .getElementById("about")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      >
        View more
      </Button>
    </div>
  )
}
