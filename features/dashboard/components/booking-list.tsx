"use client"

import { useState } from "react"
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  type Column,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"

import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
} from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatClock, formatDayShort } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import { useOwnerMessages } from "../i18n/provider"
import type { OwnerBooking } from "../types"
import { bookingActions, bookingState } from "../utils/booking-filters"
import { actionLabel, type useBookingPanels } from "./booking-panels"
import { BookingStateBadge } from "./booking-state-badge"

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
})
type Features = typeof features
const column = createColumnHelper<Features, OwnerBooking>()

const PAGE_SIZES = [10, 25, 50]
// A phone shows this many cards, then this many more per "Show more".
const PHONE_STEP = 20

type Panels = ReturnType<typeof useBookingPanels>

// Bookings as a list, the same on Home and the Bookings page: a computer
// gets a table sorted by its headers, a phone gets cards. Every row opens
// the booking; its ⋯ menu moves, cancels or marks it. With `pages` the
// table has pages and the cards a Show more; without, all are shown, or
// only the first `phoneLimit` cards on a phone.
export function BookingList({
  bookings,
  now,
  hasTeam,
  panels,
  newestFirst = false,
  pages = false,
  phoneLimit,
}: {
  bookings: OwnerBooking[]
  // ISO time the page was loaded: what is upcoming and what can be done.
  now: string
  hasTeam: boolean
  panels: Panels
  newestFirst?: boolean
  pages?: boolean
  phoneLimit?: number
}) {
  const m = useOwnerMessages()
  const t = m.bookings.list
  const [shown, setShown] = useState(PHONE_STEP)
  // Other bookings (a new search or filter) start again from the top.
  const ids = bookings.map((booking) => booking.id).join()
  const [shownIds, setShownIds] = useState(ids)
  if (shownIds !== ids) {
    setShownIds(ids)
    setShown(PHONE_STEP)
  }

  const columns = column.columns([
    column.accessor("startAt", {
      id: "date",
      header: t.columns.date,
      sortFn: "basic",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {formatDayShort(row.original.date, m.locale)}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {formatClock(row.original.time, m.locale)} –{" "}
            {formatClock(row.original.endTime, m.locale)}
          </span>
        </div>
      ),
    }),
    column.accessor("customerName", {
      id: "customer",
      header: t.columns.customer,
      sortFn: "text",
      cell: ({ row }) => (
        <div className="flex flex-col items-start">
          {/* The row opens on a click; the name is its button for the
              keyboard. */}
          <Button
            variant="link"
            className="h-auto p-0 font-medium text-foreground"
            onClick={(event) => {
              event.stopPropagation()
              panels.open(row.original, Date.now())
            }}
          >
            {row.original.customerName}
          </Button>
          {row.original.customerPhone && (
            <span className="text-muted-foreground tabular-nums">
              {row.original.customerPhone}
            </span>
          )}
        </div>
      ),
    }),
    column.accessor("serviceName", {
      id: "service",
      header: t.columns.service,
      sortFn: "text",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.serviceName}</span>
          {row.original.addons.length > 0 && (
            <span className="text-muted-foreground">
              {t.extras(row.original.addons.length)}
            </span>
          )}
        </div>
      ),
    }),
    ...(hasTeam
      ? [
          column.accessor((booking) => booking.teamMemberName ?? "", {
            id: "team",
            header: t.columns.team,
            sortFn: "text",
          }),
        ]
      : []),
    column.accessor((booking) => booking.priceMinor ?? 0, {
      id: "price",
      header: t.columns.price,
      sortFn: "basic",
      cell: ({ row }) =>
        row.original.priceMinor === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">
            {formatPrice(
              row.original.priceMinor,
              row.original.currency,
              m.locale
            )}
          </span>
        ),
    }),
    column.accessor((booking) => bookingState(booking, now), {
      id: "status",
      header: t.columns.status,
      sortFn: "text",
      cell: ({ row }) => (
        <BookingStateBadge state={bookingState(row.original, now)} />
      ),
    }),
    column.display({
      id: "actions",
      header: () => <span className="sr-only">{t.actions}</span>,
      cell: ({ row }) => (
        <RowMenu booking={row.original} now={now} panels={panels} />
      ),
    }),
  ])

  const table = useTable({
    features,
    columns,
    data: bookings,
    getRowId: (booking) => booking.id,
    autoResetPageIndex: true,
    initialState: {
      sorting: [{ id: "date", desc: newestFirst }],
      pagination: { pageIndex: 0, pageSize: PAGE_SIZES[0] },
    },
  })
  const { pageIndex, pageSize } = table.state.pagination
  const total = bookings.length
  const first = total === 0 ? 0 : pageIndex * pageSize + 1
  const last = Math.min(total, (pageIndex + 1) * pageSize)
  const sorted = table.getPrePaginatedRowModel().rows

  return (
    <>
      {/* A phone: cards, in the same order as the table. */}
      <div className="flex flex-col gap-3 md:hidden">
        <ItemGroup className="gap-3">
          {sorted.slice(0, pages ? shown : phoneLimit).map(
            ({ original: booking }) => (
              <Item
                key={booking.id}
                variant="outline"
                render={
                  <button
                    type="button"
                    onClick={() => panels.open(booking, Date.now())}
                  />
                }
                className="text-left"
              >
                <ItemContent>
                  <ItemTitle>
                    {booking.customerName}
                    <BookingStateBadge state={bookingState(booking, now)} />
                  </ItemTitle>
                  <ItemDescription>
                    {formatDayShort(booking.date, m.locale)} ·{" "}
                    {formatClock(booking.time, m.locale)} ·{" "}
                    {booking.serviceName}
                    {booking.teamMemberName && ` · ${booking.teamMemberName}`}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon />
                </ItemActions>
              </Item>
            )
          )}
        </ItemGroup>
        {pages && sorted.length > shown && (
          <Button
            variant="outline"
            onClick={() => setShown((count) => count + PHONE_STEP)}
          >
            {t.showMore}
          </Button>
        )}
      </div>

      {/* A computer: the table with sortable headers (and pages). */}
      <Card className="gap-0 py-0 max-md:hidden">
        <Table className="[&_tr>*:first-child]:pl-5 [&_tr>*:last-child]:pr-5">
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(header.column)}
                    className={
                      header.column.id === "actions" ? "w-12" : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <SortButton
                        column={header.column}
                        label={String(header.column.columnDef.header)}
                      />
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {(pages ? table.getRowModel().rows : sorted).map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => panels.open(row.original, Date.now())}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pages && (
          <div className="flex items-center justify-between gap-4 border-t px-5 py-3">
            <span className="text-muted-foreground tabular-nums">
              {t.showing(first, last, total)}
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t.rows}</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                  items={PAGE_SIZES.map((size) => ({
                    value: String(size),
                    label: String(size),
                  }))}
                >
                  <SelectTrigger size="sm" aria-label={t.rows}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="tabular-nums">
                {t.page(pageIndex + 1, Math.max(1, table.getPageCount()))}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t.previous}
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t.next}
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}

function ariaSort(
  column: Column<Features, OwnerBooking, unknown>
): "ascending" | "descending" | undefined {
  const sorted = column.getIsSorted()
  return sorted === "asc"
    ? "ascending"
    : sorted === "desc"
      ? "descending"
      : undefined
}

// A column's header that sorts by it: tap once for up, again for down.
function SortButton({
  column,
  label,
}: {
  column: Column<Features, OwnerBooking, unknown>
  label: string
}) {
  const t = useOwnerMessages().bookings.list
  const sorted = column.getIsSorted()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3"
      aria-label={t.sortBy(label)}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUpIcon data-icon="inline-end" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon data-icon="inline-end" />
      ) : (
        <ChevronsUpDownIcon
          data-icon="inline-end"
          className="text-muted-foreground"
        />
      )}
    </Button>
  )
}

// A row's ⋯ menu: open it, then what can be done with it now.
function RowMenu({
  booking,
  now,
  panels,
}: {
  booking: OwnerBooking
  now: string
  panels: Panels
}) {
  const t = useOwnerMessages().bookings
  const actions = bookingActions(booking, now)
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <MoreMenuTrigger label={t.list.actions} />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => panels.open(booking, Date.now())}>
              {t.list.open}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {actions.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            {actions.map((action) => (
              <DropdownMenuItem
                key={action}
                variant={action === "cancel" ? "destructive" : undefined}
                disabled={panels.pending}
                onClick={() => panels.act(booking, action)}
              >
                {actionLabel(t, action)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
