// The app's two control sizes, both 36px tall on a computer.
//
// Controls (buttons, tabs, filter chips, search boxes, a list's filters):
// the size of the filter chips (shadcn's Toggle, default size): 36px tall
// on a touch screen too, 14px words, 16px icons, 12px sides; a text button
// as wide as its words, an icon button square. Their tap area still grows
// to 44px each way there (Apple's minimum), drawn invisibly: Button's
// touchArea, Toggle's own, and TAB below.
//
// Fields (Input, Select, Textarea in a form) are 44px tall on a touch
// screen, since a text box can't draw its tap area invisibly; FIELD gives a
// button that stands in for a field (a date picker) the same height.
//
// Button's default and icon sizes and Toggle are controls already; the
// rest is set here.

// A 44px tap area on a touch screen, drawn invisibly. ::before, since
// ::after is the line tab's bar.
const TAP_AREA =
  "pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:top-1/2 pointer-coarse:before:min-h-11 pointer-coarse:before:-translate-y-1/2"

// Each tab in its row: a chip's height.
const TAB = `h-9 ${TAP_AREA}`

// Each part of the switcher (the default tabs' track), like Apple's
// segmented control: lower and wider than a chip, so the words sit in a
// long pill rather than a square one.
const SEGMENT = `h-8 px-4 ${TAP_AREA}`

export const CONTROL_SIZE = {
  // TabsList (default look): the 4px track around 32px segments, as tall
  // as a chip with its edge.
  tabsList: "group-data-horizontal/tabs:h-10",
  tab: TAB,
  segment: SEGMENT,
  // A search box (InputGroup), kept at 36px on a touch screen.
  search: "pointer-coarse:h-9",
  // A Select in a toolbar, like a table's rows per page.
  select: "pointer-coarse:data-[size=default]:h-9",
  // A list's row of filters (ListFilters on a computer): its selects.
  filterRow:
    "**:data-[slot=select-trigger]:data-[size=default]:pointer-coarse:h-9",
  // A Button that stands in for a field in a form.
  field: "pointer-coarse:min-h-11",
} as const
