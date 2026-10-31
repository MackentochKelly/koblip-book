import type { GoogleEventColor } from "@/lib/google-calendar-colors"
import { cn } from "@/lib/utils"

// Whole class names, so Tailwind sees each one.
const FILL: Record<GoogleEventColor, string> = {
  "1": "bg-google-event-1",
  "2": "bg-google-event-2",
  "3": "bg-google-event-3",
  "4": "bg-google-event-4",
  "5": "bg-google-event-5",
  "6": "bg-google-event-6",
  "7": "bg-google-event-7",
  "8": "bg-google-event-8",
  "9": "bg-google-event-9",
  "10": "bg-google-event-10",
  "11": "bg-google-event-11",
}

// A Google Calendar event colour (G7), as a small dot.
export function GoogleEventDot({ color, className }: { color: GoogleEventColor; className?: string }) {
  return <span aria-hidden className={cn("size-3 shrink-0 self-center rounded-full", FILL[color], className)} />
}
