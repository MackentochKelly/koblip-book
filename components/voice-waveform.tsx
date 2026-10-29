"use client"

import { useEffect, useRef } from "react"

import { useReducedMotion } from "@/hooks/use-theme-colors"
import { cn } from "@/lib/utils"

// ElevenLabs UI's Live Waveform in "scrolling" mode
// (https://ui.elevenlabs.io/docs/components/live-waveform), the one on
// shadcn's Create page. Changed in one way: it draws a level it is given
// instead of opening the microphone a second time, so it follows the
// owner's voice and the answer's voice from the one talking-live session.
const WAVEFORM = {
  barWidth: 3,
  barGap: 2,
  barRadius: 1.5,
  // The shortest bar, in pixels, and the quietest level drawn.
  minBarHeight: 4,
  minLevel: 0.05,
  // Milliseconds between new bars.
  updateRate: 30,
  // Pixels faded out at each end.
  fadeWidth: 24,
} as const

// Bars scroll in from the right with the level from `getLevel` (0 to 1).
// While `processing` (connecting or thinking) a soft wave runs instead,
// blended in from the last bars. Bars take the text colour (`text-*`).
export function VoiceWaveform({
  getLevel,
  processing,
  label,
  className,
}: {
  getLevel: () => number
  processing: boolean
  label: string
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const still = useReducedMotion()

  // Sharp on any screen: the canvas follows the box's size and pixel ratio.
  useEffect(() => {
    const element = box.current
    const paper = canvas.current
    if (!element || !paper) return
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      paper.width = rect.width * ratio
      paper.height = rect.height * ratio
      paper.getContext("2d")?.scale(ratio, ratio)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const paper = canvas.current
    const context = paper?.getContext("2d")
    if (!paper || !context) return
    let bars: number[] = []
    let last = 0
    let time = 0
    let blend = 0
    let frame = requestAnimationFrame(function draw(now) {
      frame = requestAnimationFrame(draw)
      if (now - last < WAVEFORM.updateRate) return
      last = now
      const { width, height } = paper.getBoundingClientRect()
      const step = WAVEFORM.barWidth + WAVEFORM.barGap
      const count = Math.floor(width / step)

      if (processing) {
        // The library's processing wave, eased in over the last bars.
        time += still ? 0 : 0.03
        blend = Math.min(1, blend + 0.02)
        const before = bars
        bars = Array.from({ length: count }, (_, i) => {
          const position = (i - count / 2) / (count / 2)
          const weight = 1 - Math.abs(position) * 0.4
          const wave =
            Math.sin(time * 1.5 + i * 0.15) * 0.25 +
            Math.sin(time * 0.8 - i * 0.1) * 0.2 +
            Math.cos(time * 2 + i * 0.05) * 0.15
          const value = (0.2 + wave) * weight
          const previous = before[Math.floor((i / count) * before.length)]
          const mixed =
            previous === undefined
              ? value
              : previous * (1 - blend) + value * blend
          return Math.max(WAVEFORM.minLevel, Math.min(1, mixed))
        })
      } else {
        blend = 0
        bars = [
          ...bars,
          Math.max(WAVEFORM.minLevel, Math.min(1, getLevel())),
        ].slice(-count)
      }

      context.clearRect(0, 0, width, height)
      context.fillStyle = getComputedStyle(paper).color
      bars.forEach((value, i) => {
        const x = width - (bars.length - i) * step
        const barHeight = Math.max(WAVEFORM.minBarHeight, value * height * 0.8)
        context.globalAlpha = 0.4 + value * 0.6
        context.beginPath()
        context.roundRect(
          x,
          (height - barHeight) / 2,
          WAVEFORM.barWidth,
          barHeight,
          WAVEFORM.barRadius
        )
        context.fill()
      })

      // Soft ends, as in the library: cut out with a see-through gradient.
      const fade = Math.min(0.3, WAVEFORM.fadeWidth / Math.max(width, 1))
      const gradient = context.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, "rgba(0,0,0,1)")
      gradient.addColorStop(fade, "rgba(0,0,0,0)")
      gradient.addColorStop(1 - fade, "rgba(0,0,0,0)")
      gradient.addColorStop(1, "rgba(0,0,0,1)")
      context.globalAlpha = 1
      context.globalCompositeOperation = "destination-out"
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      context.globalCompositeOperation = "source-over"
    })
    return () => cancelAnimationFrame(frame)
  }, [getLevel, processing, still])

  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      className={cn("relative min-w-0", className)}
    >
      <canvas ref={canvas} aria-hidden className="block size-full" />
    </div>
  )
}
