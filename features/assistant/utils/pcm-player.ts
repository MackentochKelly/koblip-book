import { VOICE_RULES } from "@/lib/voice-rules"

import { base64Pcm16ToFloat, level } from "./pcm"

// Plays ElevenLabs' PCM chunks back to back, gapless, and says how loud it
// is right now for the globe. stop() cuts it off at once (the owner talked
// over it). It also knows which words have started playing, so a cut-off
// answer is remembered as only what the owner heard (OpenAI's Realtime
// guide truncates an interrupted reply the same way:
// https://developers.openai.com/api/docs/guides/realtime-conversations).
export class PcmPlayer {
  private readonly analyser: AnalyserNode
  private readonly samples: Float32Array<ArrayBuffer>
  private readonly sources = new Set<AudioBufferSourceNode>()
  private nextStart = 0
  // Each chunk's words and when it starts, since the last forget().
  private words: { start: number; text: string }[] = []
  // Called when the last queued chunk has finished playing.
  onIdle: () => void = () => {}

  constructor(private readonly context: AudioContext) {
    this.analyser = context.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.connect(context.destination)
    this.samples = new Float32Array(this.analyser.fftSize)
  }

  play(base64: string, words = "") {
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
    if (words) this.words.push({ start, text: words })
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      if (this.sources.size === 0) this.onIdle()
    }
  }

  get playing() {
    return this.sources.size > 0
  }

  // Also sends what plays to `node` (the waveform's analyser).
  connect(node: AudioNode) {
    this.analyser.connect(node)
  }

  volume = () => {
    if (this.sources.size === 0) return 0
    this.analyser.getFloatTimeDomainData(this.samples)
    return level(this.samples)
  }

  // The words that have started playing.
  heard() {
    const now = this.context.currentTime
    return this.words
      .filter((chunk) => chunk.start <= now)
      .map((chunk) => chunk.text)
      .join("")
      .trim()
  }

  forget() {
    this.words = []
  }

  stop() {
    // Words that never got to play were never heard.
    const now = this.context.currentTime
    this.words = this.words.filter((chunk) => chunk.start <= now)
    for (const source of this.sources) {
      source.onended = null
      source.stop()
    }
    this.sources.clear()
    this.nextStart = 0
  }
}
