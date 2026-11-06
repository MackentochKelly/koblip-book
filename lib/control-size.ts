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

// Each tab in its row: a chip's height, with a 44px tap area on a touch
// screen. ::before, since ::after is the line tab's bar.
const TAB =
  "h-9 pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:top-1/2 pointer-coarse:before:min-h-11 pointer-coarse:before:-translate-y-1/2"

export const CONTROL_SIZE = {
  // TabsList (default look): the 4px track around 36px tabs.
  tabsList: "group-data-horizontal/tabs:h-11",
  tab: TAB,
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
