"use client"

import { SortableList } from "@/components/sortable-list"
import { PageSection } from "@/components/page-section"
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
  useWidgetAnnouncements,
  useWidgetLayout,
} from "../hooks/use-widget-layout"
import { useOwnerMessages } from "../i18n/provider"
import { setShown } from "../utils/widget-layout"
import { WIDGETS, type WidgetLayout } from "../widgets"

const ICONS = Object.fromEntries(
  WIDGETS.map((widget) => [widget.id, widget.icon])
)

// The Widgets page: every widget Home can show, in Home's order. Drag a
// row by its handle to move it, switch it on or off, and choose whether the
// layout follows the owner to every device or stays on this one. Each change
// saves at once.
export function WidgetsView({
  businessId,
  layout: savedLayout,
  device: savedDevice,
}: {
  businessId: string
  layout: WidgetLayout
  device: boolean
}) {
  const m = useOwnerMessages()
  const t = m.widgets
  const { layout, device, save } = useWidgetLayout(
    businessId,
    savedLayout,
    savedDevice
  )
  const { announcements, instructions } = useWidgetAnnouncements()
  const places = [
    { device: false, label: t.everyDevice },
    { device: true, label: t.thisDevice },
  ]

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">
        {t.title}
      </h1>

      <SortableList
        ids={layout.order}
        onReorder={(order) => save({ ...layout, order })}
        handleLabel={(id) => t.move(t.names[id])}
        announcements={announcements}
        instructions={instructions}
        className="flex flex-col gap-3"
      >
        {(id, handle) => {
          const Icon = ICONS[id]
          const name = t.names[id]
          const shown = !layout.hidden.includes(id)
          return (
            <Item variant="outline" className="bg-card">
              {handle}
              <ItemMedia variant="icon">
                <Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  <label htmlFor={`widget-${id}`}>{name}</label>
                </ItemTitle>
              </ItemContent>
              <ItemActions>
                <Switch
                  id={`widget-${id}`}
                  checked={shown}
                  aria-label={t.show(name)}
                  onCheckedChange={(next) => save(setShown(layout, id, next))}
                />
              </ItemActions>
            </Item>
          )
        }}
      </SortableList>

      <PageSection id="saved-for" title={t.savedFor}>
        <RadioGroup
          value={device ? "device" : "account"}
          onValueChange={(next) => save(layout, next === "device")}
          aria-label={t.savedFor}
        >
          {places.map((place) => {
            const value = place.device ? "device" : "account"
            return (
              <FieldLabel key={value} htmlFor={`saved-for-${value}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{place.label}</FieldTitle>
                  </FieldContent>
                  <RadioGroupItem value={value} id={`saved-for-${value}`} />
                </Field>
              </FieldLabel>
            )
          })}
        </RadioGroup>
      </PageSection>
    </div>
  )
}
