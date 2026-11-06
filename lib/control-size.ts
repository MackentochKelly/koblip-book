// One size for controls that sit with filter chips, taken from the chips
// (shadcn's Toggle, default size): 36px tall, 14px words, 16px icons, 12px
// sides, a text button as wide as its words and an icon button square.
// Button's default and icon sizes are 36px already but grow to 44px on a
// touch screen; these keep them at 36px there, since Button still draws its
// invisible 44px tap area each way (Apple's minimum).
export const CONTROL_SIZE = {
  // With <Button size="default">.
  button: "pointer-coarse:min-h-9",
  // With <Button size="icon">, or MoreMenuTrigger size="icon".
  icon: "pointer-coarse:min-h-9 pointer-coarse:min-w-9",
  // ViewTabs: each tab a chip's height, so the row around it is 44px.
  tabsList: "group-data-horizontal/tabs:h-11",
  tab: "h-9",
} as const
