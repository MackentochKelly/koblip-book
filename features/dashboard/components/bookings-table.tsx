"use client"

import { useState } from "react"

import { DateRangePicker, type DayRangeValue } from "@/components/date-range-picker"
import { FacetFilter } from "@/components/facet-filter"
import { FilterChecks, FilterSheet } from "@/components/filter-sheet"
import { ViewTabs } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CalendarDaysIcon, SearchIcon, XIcon } from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  // The phone's Filters count: the dates when not the usual ones, and
  // each list with something ticked.
  const usualDates = presetOf(range, today) === "around"
  const filterCount =
    (usualDates ? 0 : 1) +
    (filters.serviceIds.length > 0 ? 1 : 0) +
    (filters.teamIds.length > 0 ? 1 : 0)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* A computer: search, dates and filters in one row. A phone: search
          and one Filters button for a sheet with the rest. */}
      <div className="flex items-center gap-2 md:flex-wrap">
        <InputGroup className="min-w-0 flex-1 md:w-80 md:flex-none">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={filters.search}
            onChange={(event) => set({ search: event.target.value })}
            placeholder={t.search}
            aria-label={t.search}
          />
        </InputGroup>
        <div className="md:hidden">
          <FilterSheet
            label={t.filters}
            count={filterCount}
            clearLabel={t.clearAll}
            onClear={() => {
              set({ serviceIds: [], teamIds: [] })
              if (!usualDates) onRangeChange(presetRange("around", today))
            }}
            doneLabel={t.showResults(total)}
          >
            <FieldSet>
              <FieldLegend variant="label">{t.dates}</FieldLegend>
              <DateRangePicker
                value={range}
                onChange={onRangeChange}
                locale={m.locale}
                label={t.dates}
                choices={rangeChoices}
                className="w-full justify-start"
              />
            </FieldSet>
            {services.length > 1 && (
              <FilterChecks
                id="filter-services"
                legend={t.services}
                options={serviceOptions}
                value={filters.serviceIds}
                onChange={(serviceIds) => set({ serviceIds })}
              />
            )}
            {hasTeam && (
              <FilterChecks
                id="filter-team"
                legend={t.team}
                options={teamOptions}
                value={filters.teamIds}
                onChange={(teamIds) => set({ teamIds })}
              />
            )}
          </FilterSheet>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-md:hidden">
          <DateRangePicker
            value={range}
            onChange={onRangeChange}
            locale={m.locale}
            label={t.dates}
            choices={rangeChoices}
          />
          {services.length > 1 && (
            <FacetFilter
              label={t.services}
              options={serviceOptions}
              value={filters.serviceIds}
              onChange={(serviceIds) => set({ serviceIds })}
            />
          )}
          {hasTeam && (
            <FacetFilter
              label={t.team}
              options={teamOptions}
              value={filters.teamIds}
              onChange={(teamIds) => set({ teamIds })}
            />
          )}
          {filtered && (
            <Button
              variant="ghost"
              onClick={() => set({ ...NO_FILTERS, status: filters.status })}
            >
              {t.clear}
              <XIcon data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>

      {/* A phone picks the status from a list, a computer from tabs. */}
      <Select
        value={filters.status}
        onValueChange={(status) => {
          if (status) set({ status })
        }}
        items={statusTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
      >
        <SelectTrigger aria-label={t.status} className="w-full md:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusTabs.map((tab) => (
            <SelectItem key={tab.id} value={tab.id}>
              {tab.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
