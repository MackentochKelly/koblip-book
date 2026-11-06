"use client"

import { Fragment, useState } from "react"

import { BottomPanel } from "@/components/bottom-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import { FilterIcon, XIcon } from "@/components/ui/icons"
import { CONTROL_SIZE } from "@/lib/control-size"
import { cn } from "@/lib/utils"

export interface ListFilter {
  key: string
  label: string
  // The control, full width on a phone (`w-full md:w-auto`).
  control: React.ReactNode
  // Another control for the computer's row, or null for phone only (when
  // the computer shows it elsewhere, like tabs).
  rowControl?: React.ReactNode | null
}

export interface ListFiltersWords {
  filters: string
  clearAll: string
  clear: string
  // Like "Show 5 bookings"; it closes the sheet.
  showResults: string
}

// Every list's search and filters. A computer: search and the filters in
// one row, with Clear while one is on, all a filter chip's size
// (lib/control-size). A phone: search and one "Filters 2"
// button for a bottom sheet with every filter, labelled; a change shows at
// once, Clear all and the results button sit at the foot.
export function ListFilters({
  search,
  filters,
  count,
  onClear,
  rowClear,
  words,
}: {
  search?: React.ReactNode
  filters: ListFilter[]
  // How many filters are on, shown on the phone's button.
  count: number
  // Clear all, in the sheet.
  onClear: () => void
  // The row's Clear, shown when given.
  rowClear?: () => void
  words: ListFiltersWords
}) {
  const [open, setOpen] = useState(false)
  if (filters.length === 0) return search ?? null
  return (
    <div className="flex items-center gap-2 md:flex-wrap">
      {search}
      <div className={search ? "md:hidden" : "w-full md:hidden"}>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className={search ? undefined : "w-full"}
        >
          <FilterIcon data-icon="inline-start" />
          {words.filters}
          {count > 0 && <Badge variant="secondary">{count}</Badge>}
        </Button>
        <BottomPanel
          open={open}
          onClose={() => setOpen(false)}
          title={words.filters}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={onClear}
                disabled={count === 0}
              >
                {words.clearAll}
              </Button>
              <Button size="lg" onClick={() => setOpen(false)}>
                {words.showResults}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-6">
            {filters.map((filter) => (
              <FieldSet key={filter.key}>
                <FieldLegend variant="label">{filter.label}</FieldLegend>
                {filter.control}
              </FieldSet>
            ))}
          </div>
        </BottomPanel>
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 max-md:hidden",
          CONTROL_SIZE.filterRow
        )}
      >
        {filters.map(
          (filter) =>
            filter.rowControl !== null && (
              <Fragment key={filter.key}>
                {filter.rowControl ?? filter.control}
              </Fragment>
            )
        )}
        {rowClear && (
          <Button variant="ghost" onClick={rowClear}>
            {words.clear}
            <XIcon data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  )
}
