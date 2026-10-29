import { VOICE_RULES } from "@/lib/voice-rules"

import { base64Pcm16ToFloat, level } from "./pcm"

// Plays ElevenLabs' PCM chunks back to back, gapless, and says how loud it
// is right now for the orb. stop() cuts it off at once (the owner talked
// over it).
export class PcmPlayer {
  private readonly analyser: AnalyserNode
  private readonly samples: Float32Array<ArrayBuffer>
  private readonly sources = new Set<AudioBufferSourceNode>()
  private nextStart = 0

  constructor(
    private readonly context: AudioContext,
    // Called when the last queued chunk has finished playing.
    private readonly onIdle: () => void
  ) {
    this.analyser = context.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.connect(context.destination)
    this.samples = new Float32Array(this.analyser.fftSize)
  }

  play(base64: string) {
    const pcm = base64Pcm16ToFloat(base64)
    if (pcm.length === 0) return
    const buffer = this.context.createBuffer(
      1,
      pcm.length,
      VOICE_RULES.speakSampleRate
    )
    buffer.copyToChannel(pcm, 0)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.analyser)
    const start = Math.max(this.context.currentTime, this.nextStart)
    source.start(start)
    this.nextStart = start + buffer.duration
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      if (this.sources.size === 0) this.onIdle()
    }
  }

  get playing() {
    return this.sources.size > 0
  }

  volume = () => {
    if (this.sources.size === 0) return 0
    this.analyser.getFloatTimeDomainData(this.samples)
    return level(this.samples)
  }

  stop() {
    for (const source of this.sources) {
      source.onended = null
      source.stop()
    }
    this.sources.clear()
    this.nextStart = 0
  }
}
