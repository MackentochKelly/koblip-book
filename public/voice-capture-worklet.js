// Live voice microphone tap (https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet).
// Runs on the browser's audio thread: it only gathers the 128-sample blocks
// into ~43 ms batches and posts them; the page resamples and frames them.
const BATCH = 2048

class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.batch = new Float32Array(BATCH)
    this.filled = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel) {
      let read = 0
      while (read < channel.length) {
        const take = Math.min(channel.length - read, BATCH - this.filled)
        this.batch.set(channel.subarray(read, read + take), this.filled)
        this.filled += take
        read += take
        if (this.filled === BATCH) {
          this.port.postMessage(this.batch, [this.batch.buffer])
          this.batch = new Float32Array(BATCH)
          this.filled = 0
        }
      }
    }
    return true
  }
}

registerProcessor("voice-capture", VoiceCapture)
