import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// The app's time box (shadcn's Time Picker): the browser's time field
// without its own look, so it is the same size as every other box. On
// iPhone, Safari's own drawing ignored our size and made it too big.
export function TimeInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  return (
    <Input
      type="time"
      className={cn(
        "appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        className
      )}
      {...props}
    />
  )
}
