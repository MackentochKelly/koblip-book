"use client"

import { useState } from "react"
import Link from "next/link"
import {
  LayoutGridIcon,
  PlusIcon,
  SquarePenIcon,
  XIcon,
} from "@/components/ui/icons"

import { PageSection } from "@/components/page-section"
import { SortableList } from "@/components/sortable-list"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import {
  useWidgetAnnouncements,
  useWidgetLayout,
} from "../hooks/use-widget-layout"
import { useOwnerMessages } from "../i18n/provider"
import { reorderShown, setShown, shownWidgets } from "../utils/widget-layout"
import { WIDGETS, type WidgetId, type WidgetLayout } from "../widgets"

// One column on a phone; on a wide screen two, so "half" widgets sit side
// by side. On a computer more room between rows than between the two
// cards of a row, so each row reads as one section. Each widget's box is a grid too, so
// cards side by side stretch to the same height.
const GRID = "grid gap-6 md:gap-y-10 lg:grid-cols-2"
const FULL = "lg:col-span-2"

// A widget that draws nothing (Get the app, once installed) hides with its
// heading.
const HIDES_EMPTY = "has-[>[data-widget]:empty]:hidden"

const span = (id: WidgetId) =>
  WIDGETS.find((widget) => widget.id === id)?.size === "full" ? FULL : undefined

// Home's widgets in the owner's order, each under its heading like an
// Apple app's sections (an `actions` link, like View all, beside it; a
// widget with nothing to show hides with its heading). Edit widgets (at the
// foot, like the iPhone's widget list) lets each one be dragged by its
// handle or taken off with its X; Add widget opens the Widgets page for the
// rest; Done ends it. While editing, the widgets themselves don't react to
// taps.
export function WidgetBoard({
  businessId,
  layout: savedLayout,
  device: savedDevice,
  widgets,
  actions,
}: {
  businessId: string
  layout: WidgetLayout
  device: boolean
  widgets: Record<WidgetId, React.ReactNode>
  actions?: Partial<Record<WidgetId, React.ReactNode>>
}) {
  const t = useOwnerMessages().widgets
  const [editing, setEditing] = useState(false)
  const { layout, save } = useWidgetLayout(businessId, savedLayout, savedDevice)
  const { announcements, instructions } = useWidgetAnnouncements()
  const shown = shownWidgets(layout)
  const widgetsPage = `/dashboard/${businessId}/widgets`

  const addWidget = (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link href={widgetsPage} />}
    >
      <PlusIcon data-icon="inline-start" />
      {t.add}
    </Button>
  )

  if (shown.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutGridIcon />
          </EmptyMedia>
          <EmptyTitle>{t.noneShown}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>{addWidget}</EmptyContent>
      </Empty>
    )
  }

  if (!editing) {
    return (
      <div className={GRID}>
        {shown.map((id) => (
          <PageSection
            key={id}
            id={`widget-${id}`}
            title={t.headings[id]}
            action={actions?.[id]}
            className={cn("min-w-0", HIDES_EMPTY, span(id))}
          >
            <div data-widget className="grid flex-1">
              {widgets[id]}
            </div>
          </PageSection>
        ))}
        <Button
          variant="ghost"
          className={cn("justify-self-center", FULL)}
          onClick={() => setEditing(true)}
        >
          <SquarePenIcon data-icon="inline-start" />
          {t.edit}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-10">
      <SortableList
        ids={shown}
        onReorder={(next) => save(reorderShown(layout, next))}
        handleLabel={(id) => t.move(t.names[id])}
        announcements={announcements}
        instructions={instructions}
        layout="grid"
        className={GRID}
        rowClassName={span}
      >
        {(id, handle) => (
          <PageSection
            id={`widget-${id}`}
            title={t.headings[id]}
            className={cn(
              "relative h-full min-w-0 rounded-4xl outline-2 outline-offset-4 outline-border outline-dashed",
              HIDES_EMPTY
            )}
          >
            <div inert data-widget className="grid flex-1">
              {widgets[id]}
            </div>
            <div className="absolute top-2 right-2 flex gap-1 rounded-full border bg-background p-1">
              {handle}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.remove(t.names[id])}
                onClick={() => save(setShown(layout, id, false))}
              >
                <XIcon />
              </Button>
            </div>
          </PageSection>
        )}
      </SortableList>
      <div className="flex flex-col gap-2 md:flex-row md:justify-center">
        {addWidget}
        <Button onClick={() => setEditing(false)}>{t.done}</Button>
      </div>
    </div>
  )
}
