"use client"

import { useState } from "react"

import { DateRangePicker, type DayRangeValue } from "@/components/date-range-picker"
import { ListFilters } from "@/components/list-filters"
import { ViewTabs } from "@/components/view-tabs"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CalendarDaysIcon } from "@/components/ui/icons"
import { AppSelect } from "@/components/app-select"
import { useOwnerMessages } from "../i18n/provider"
import type { OwnerBooking } from "../types"
import {
  type BookingFilters,
  byStatus,
  matchBookings,
  NO_FILTERS,
  STATUS_FILTERS,
  statusCounts,
} from "../utils/booking-filters"
import { RANGE_PRESETS, presetOf, presetRange } from "../utils/booking-range"
import { BookingList } from "./booking-list"
import type { useBookingPanels } from "./booking-panels"

type Panels = ReturnType<typeof useBookingPanels>

// The Bookings tab: the bookings in a date range, searched and filtered by
// status, service and team, as the shared list with pages.
export function BookingsTable({
  bookings,
  now,
  today,
  range,
  onRangeChange,
  services,
  team,
  panels,
}: {
  bookings: OwnerBooking[]
  // ISO time the page was loaded: what is upcoming and what can be done.
  now: string
  today: string
  range: DayRangeValue
  onRangeChange: (range: DayRangeValue) => void
  services: { id: string; name: string }[]
  team: { id: string; name: string }[]
  panels: Panels
}) {
  const m = useOwnerMessages()
  const t = m.bookings.list
  const [filters, setFilters] = useState<BookingFilters>(NO_FILTERS)
  const hasTeam = team.length > 0
  const set = (change: Partial<BookingFilters>) => {
    setFilters((current) => ({ ...current, ...change }))
  }
  const matched = matchBookings(bookings, filters)
  const counts = statusCounts(matched, now)
  const rows = byStatus(matched, filters.status, now)
  const total = rows.length
  const filtered =
    filters.search.trim() !== "" ||
    filters.serviceIds.length > 0 ||
    filters.teamIds.length > 0

  const statusTabs = STATUS_FILTERS.map((status) => ({
    id: status,
    label: `${t.statuses[status]} ${counts[status]}`,
  }))
  const rangeChoices = RANGE_PRESETS.map((preset) => ({
    id: preset,
    label: t.presets[preset],
    range: presetRange(preset, today),
  }))
  const serviceOptions = services.map(({ id, name }) => ({
    value: id,
    label: name,
  }))
  const teamOptions = team.map(({ id, name }) => ({ value: id, label: name }))
  // The phone's Filters count: a status other than All, the dates when not
  // the usual ones, and each list with something ticked.
  const usualDates = presetOf(range, today) === "around"
  const filterCount =
    (filters.status === NO_FILTERS.status ? 0 : 1) +
    (usualDates ? 0 : 1) +
    (filters.serviceIds.length > 0 ? 1 : 0) +
    (filters.teamIds.length > 0 ? 1 : 0)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ListFilters
        search={
          <SearchField
            className="min-w-0 flex-1 md:w-80 md:flex-none"
            value={filters.search}
            onChange={(event) => set({ search: event.target.value })}
            placeholder={t.search}
            aria-label={t.search}
          />
        }
        filters={[
          {
            // A computer picks the status from the tabs under the row.
            key: "status",
            label: t.status,
            control: (
              <AppSelect
                value={filters.status}
                onValueChange={(status) => set({ status })}
                options={statusTabs.map((tab) => ({
                  value: tab.id,
                  label: tab.label,
                }))}
                aria-label={t.status}
                className="w-full"
              />
            ),
            rowControl: null,
          },
          {
            key: "dates",
            label: t.dates,
            control: (
              <DateRangePicker
                value={range}
                onChange={onRangeChange}
                locale={m.locale}
                label={t.dates}
                choices={rangeChoices}
                className="w-full justify-start"
              />
            ),
            rowControl: (
              <DateRangePicker
                value={range}
                onChange={onRangeChange}
                locale={m.locale}
                label={t.dates}
                choices={rangeChoices}
              />
            ),
          },
          ...(services.length > 1
            ? [
                {
                  key: "services",
                  label: t.services,
                  control: (
                    <AppSelect
                      multiple
                      options={serviceOptions}
                      value={filters.serviceIds}
                      onValueChange={(serviceIds) => set({ serviceIds })}
                      placeholder={t.services}
                      aria-label={t.services}
                      className="w-full md:w-auto"
                    />
                  ),
                },
              ]
            : []),
          ...(hasTeam
            ? [
                {
                  key: "team",
                  label: t.team,
                  control: (
                    <AppSelect
                      multiple
                      options={teamOptions}
                      value={filters.teamIds}
                      onValueChange={(teamIds) => set({ teamIds })}
                      placeholder={t.team}
                      aria-label={t.team}
                      className="w-full md:w-auto"
                    />
                  ),
                },
              ]
            : []),
        ]}
        count={filterCount}
        onClear={() => {
          set({ status: NO_FILTERS.status, serviceIds: [], teamIds: [] })
          if (!usualDates) onRangeChange(presetRange("around", today))
        }}
        rowClear={
          filtered
            ? () => set({ ...NO_FILTERS, status: filters.status })
            : undefined
        }
        words={{
          filters: t.filters,
          clearAll: t.clearAll,
          clear: t.clear,
          showResults: t.showResults(total),
        }}
      />

      <ViewTabs
        views={statusTabs}
        value={filters.status}
        onChange={(status) => set({ status })}
        ariaLabel={m.bookings.title}
        className="max-md:hidden"
        listClassName="w-fit"
      />

      {total === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDaysIcon />
            </EmptyMedia>
            <EmptyTitle>
              {bookings.length === 0 ? t.noneInRange : t.noMatch}
            </EmptyTitle>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => set({ ...NO_FILTERS, status: filters.status })}
              >
                {t.clear}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <BookingList
          bookings={rows}
          now={now}
          today={today}
          hasTeam={hasTeam}
          panels={panels}
          pages
        />
      )}
    </div>
  )
}
