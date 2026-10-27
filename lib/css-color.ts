// Turns any CSS colour the browser knows (oklch, lab, a theme token's
// value…) into "rgb(r, g, b)", for libraries that only read hex/rgb/hsl.
// Browser only: it paints one pixel on a canvas and reads it back.
export function cssColorToRgb(value: string): string {
  const probe = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true })
  if (!probe) return value
  probe.fillStyle = value
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${g}, ${b})`
}
