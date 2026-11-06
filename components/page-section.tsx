import { InfoTip } from "@/components/info-tip"
import { cn } from "@/lib/utils"

// A titled part of the page that the section tabs scroll to. The title is
// Apple's section title: big and bold above its cards, an action (View all)
// at its right. `info`: more words behind an ⓘ beside the title, for a
// section that needs them (`infoLabel` names the ⓘ for screen readers).
export function PageSection({
  id,
  title,
  info,
  infoLabel,
  action,
  className,
  children,
}: {
  id: string
  title: string
  info?: React.ReactNode
  infoLabel?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("flex scroll-mt-16 flex-col gap-3", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 id={`${id}-title`} className="text-lg font-bold tracking-tight">
            {title}
          </h2>
          {/* The 32px ⓘ keeps the title's line height. */}
          {info && (
            <InfoTip label={infoLabel} className="-my-1">
              {info}
            </InfoTip>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
