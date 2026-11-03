"use client"

import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react"

import { audioLevel } from "@/lib/audio-level"

// How loud an <audio> element is right now (0..1), for a globe that moves
// with it. connect() sends the element's sound through an analyser; call it
// inside the tap that starts playing, since phones (iOS Safari) only let an
// AudioContext start inside a tap, and a stopped one would mute the element.
// A file from another site needs crossOrigin="anonymous" on the element.
// https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource
export function useAudioLevel(
  audio: RefObject<HTMLAudioElement | null>,
  fftSize: number
) {
  const graph = useRef<{
    context: AudioContext
    analyser: AnalyserNode
    samples: Float32Array<ArrayBuffer>
  } | null>(null)

  useEffect(
    () => () => {
      void graph.current?.context.close()
      graph.current = null
    },
    []
  )

  const connect = useCallback(() => {
    const element = audio.current
    if (!element) return
    if (!graph.current) {
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = fftSize
      // An element can feed only one source node, ever.
      context.createMediaElementSource(element).connect(analyser)
      analyser.connect(context.destination)
      graph.current = {
        context,
        analyser,
        samples: new Float32Array(analyser.fftSize),
      }
    }
    void graph.current.context.resume()
  }, [audio, fftSize])

  const level = useCallback(() => {
    const element = audio.current
    const current = graph.current
    if (!element || element.paused || !current) return 0
    current.analyser.getFloatTimeDomainData(current.samples)
    return audioLevel(current.samples)
  }, [audio])

  return useMemo(() => ({ connect, level }), [connect, level])
}
