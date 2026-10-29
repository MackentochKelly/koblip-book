"use client"

import { useEffect, useRef } from "react"

import { useReducedMotion } from "@/hooks/use-theme-colors"
import { cn } from "@/lib/utils"
import { VOICE_RULES } from "@/lib/voice-rules"

// ElevenLabs UI's Live Waveform in "static" mode
// (https://ui.elevenlabs.io/docs/components/live-waveform), the one on
// shadcn's Create page. Changed in two ways: it reads an analyser it is
// given instead of opening the microphone a second time, and every bar is
// solid (no see-through quiet bars).
const WAVEFORM = {
  barWidth: 3,
  barGap: 2,
  barRadius: 1.5,
  // The shortest bar, in pixels, and the quietest level drawn.
  minBarHeight: 4,
  minLevel: 0.05,
  // Milliseconds between updates.
  updateRate: 30,
  // The part of the spectrum where voices are (the library's 5% to 40%).
  fromBin: 0.05,
  toBin: 0.4,
} as const

// Bars stay in place and grow from the middle out with the voice: low
// pitches in the centre, high ones at the sides. While `processing`
// (connecting or thinking) a soft wave runs instead, blended in from the
// last bars. Bars take the text colour (`text-*`).
export function VoiceWaveform({
  getFrequencies,
  processing,
  label,
  className,
}: {
  getFrequencies: (into: Uint8Array<ArrayBuffer>) => boolean
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
    const data = new Uint8Array(VOICE_RULES.waveformFftSize / 2)
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
      const half = Math.floor(width / step / 2)
      const clamp = (value: number) =>
        Math.max(WAVEFORM.minLevel, Math.min(1, value))

      if (processing) {
        // The library's static processing wave, eased in from the bars.
        time += still ? 0 : 0.03
        blend = Math.min(1, blend + 0.02)
        const before = bars
        bars = Array.from({ length: half * 2 }, (_, i) => {
          const position = (i - half) / half
          const weight = 1 - Math.abs(position) * 0.4
          const wave =
            Math.sin(time * 1.5 + position * 3) * 0.25 +
            Math.sin(time * 0.8 - position * 2) * 0.2 +
            Math.cos(time * 2 + position) * 0.15
          const value = (0.2 + wave) * weight
          const previous = before[i]
          return clamp(
            previous === undefined
              ? value
              : previous * (1 - blend) + value * blend
          )
        })
      } else {
        blend = 0
        const heard = getFrequencies(data)
        const voice = data.subarray(
          Math.floor(data.length * WAVEFORM.fromBin),
          Math.floor(data.length * WAVEFORM.toBin)
        )
        const side = Array.from({ length: half }, (_, i) =>
          clamp(heard ? voice[Math.floor((i / half) * voice.length)] / 255 : 0)
        )
        bars = [...side.toReversed(), ...side]
      }

      context.clearRect(0, 0, width, height)
      context.fillStyle = getComputedStyle(paper).color
      const left = (width - bars.length * step + WAVEFORM.barGap) / 2
      bars.forEach((value, i) => {
        const barHeight = Math.max(WAVEFORM.minBarHeight, value * height * 0.8)
        context.beginPath()
        context.roundRect(
          left + i * step,
          (height - barHeight) / 2,
          WAVEFORM.barWidth,
          barHeight,
          WAVEFORM.barRadius
        )
        context.fill()
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [getFrequencies, processing, still])

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
