"use client"

import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { InfoTip } from "@/components/info-tip"
import { Switch } from "@/components/ui/switch"

export type SwitchGroup<Key extends string> = {
  id: string
  title: string
  // More words behind an ⓘ beside the group's title.
  about: string
  items: readonly { key: Key; name: string; on: boolean }[]
}

// Groups of on/off switches, one per row, each with its name: the bell's
// choices and the Email page's emails. The caller keeps what is on and
// saves each change; `idPrefix` keeps the switches' ids apart on a page.
export function SwitchGroups<Key extends string>({
  groups,
  idPrefix,
  moreInfo,
  onChange,
  lead,
}: {
  groups: readonly SwitchGroup<Key>[]
  idPrefix: string
  // The ⓘ button's name for screen readers.
  moreInfo: string
  onChange: (key: Key, on: boolean) => void
  // A choice before the groups.
  lead?: React.ReactNode
}) {
  return (
    <FieldGroup>
      {lead}
      {groups.map((group) => (
        <FieldSet key={group.id}>
          {/* The ⓘ keeps the name's line height (32px button, 24px line). */}
          <FieldLegend className="flex items-center gap-1">
            {group.title}
            <InfoTip label={moreInfo} className="-my-1">
              {group.about}
            </InfoTip>
          </FieldLegend>
          <FieldGroup className="gap-3">
            {group.items.map((item) => {
              const id = `${idPrefix}-${item.key}`
              return (
                <FieldLabel key={item.key} htmlFor={id}>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>{item.name}</FieldTitle>
                    </FieldContent>
                    <Switch
                      id={id}
                      checked={item.on}
                      onCheckedChange={(next) => onChange(item.key, next)}
                    />
                  </Field>
                </FieldLabel>
              )
            })}
          </FieldGroup>
        </FieldSet>
      ))}
    </FieldGroup>
  )
}
